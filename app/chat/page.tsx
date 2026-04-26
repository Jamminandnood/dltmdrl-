'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  // 1. 모든 상태(State) 선언
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showMySettings, setShowMySettings] = useState(false);
  const [editName, setEditName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 2. 초기 로딩 및 실시간 구독
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ ...user, ...profile });

      await supabase.from('profiles').update({ is_online: true }).eq('id', user.id);
      
      fetchUsers();
      fetchMessages();

      const channel = supabase.channel('chat_main_v2')
        .on('postgres_changes' as any, { event: '*', table: 'messages', schema: 'public' }, () => fetchMessages())
        .on('postgres_changes' as any, { event: '*', table: 'profiles', schema: 'public' }, () => fetchUsers())
        .subscribe();

      const setOffline = () => supabase.from('profiles').update({ is_online: false }).eq('id', user.id);
      window.addEventListener('beforeunload', setOffline as any);
      
      return () => {
        setOffline();
        window.removeEventListener('beforeunload', setOffline as any);
        supabase.removeChannel(channel);
      };
    };
    init();
  }, []);

  // 3. 메시지 및 유저 데이터 가져오기 함수
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(nickname, email)')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error("데이터 로드 에러:", error.message);
      return;
    }
    setMessages(data || []);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
  };

  // 4. 메시지 전송 로직
  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content && !imageUrl) return;

    if (currentUser?.is_banned) {
      alert("차단된 사용자입니다.");
      return;
    }

    // DB 컬럼명 user_id와 room_id 제약 조건을 피하기 위한 최소한의 데이터
    const { error } = await supabase.from('messages').insert([
      { 
        content: content || null, 
        user_id: currentUser.id, 
        image_url: imageUrl || null 
      }
    ]);

    if (error) {
      alert("전송 실패: " + error.message);
    } else {
      setInputText('');
      fetchMessages();
    }
  };

  // 5. 이미지 업로드
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${Date.now()}_${file.name}`;
    const { data } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      handleSendMessage(undefined, publicUrl);
    }
  };

  // 6. 관리자 및 프로필 액션
  const adminAction = async (type: string, targetId: string) => {
    let updateData: any = {};
    if (type === 'mute') updateData = { mute_until: new Date(Date.now() + 600000).toISOString() };
    else if (type === 'unmute') updateData = { mute_until: new Date(0).toISOString() };
    else if (type === 'ban') updateData = { is_banned: true };
    else if (type === 'unban') updateData = { is_banned: false };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', targetId);
    if (!error) {
      alert("완료");
      setSelectedUser(null);
      fetchUsers();
    }
  };

  const updateNickname = async (targetId: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('profiles').update({ nickname: editName }).eq('id', targetId);
    if (!error) {
      setEditName('');
      if (targetId === currentUser.id) window.location.reload();
      else { setSelectedUser(null); fetchUsers(); }
    }
  };

  // 7. 화면 렌더링 (UI)
  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden font-sans">
      {/* 사이드바 */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10 text-[#5865f2]">CHAT SERVER</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-green-500 mb-2 uppercase tracking-widest">● ONLINE</h3>
            {users.filter(u => u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer text-sm flex justify-between items-center">
                <span className="truncate">{u.nickname || u.email?.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold ml-1">ADMIN</span>}
              </div>
            ))}
          </div>
          {/* 오프라인/차단 목록 생략 가능하지만 구조 유지 */}
        </div>
        <div onClick={() => { setEditName(currentUser?.nickname || ''); setShowMySettings(true); }} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer border-t border-black/20">
          <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center font-bold text-xs">ME</div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser?.nickname || "사용자"}</p>
          </div>
        </div>
      </div>

      {/* 메인 채팅창 */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 scroll-smooth">
          {messages.length > 0 ? messages.map((m: any) => (
            <div key={m.id} className="flex flex-col group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#5865f2]">
                  {m.profiles?.nickname || m.profiles?.email?.split('@')[0] || "익명"}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {m.content && (
                <div className="bg-[#2e3037] p-3 rounded-r-2xl rounded-bl-2xl inline-block max-w-[75%] text-sm shadow-md">
                  {m.content}
                </div>
              )}
              {m.image_url && (
                <img src={m.image_url} alt="upload" className="mt-2 rounded-xl max-w-sm border border-black/20 shadow-lg" />
              )}
            </div>
          )) : (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">메시지가 없습니다.</div>
          )}
        </div>

        {/* 입력창 */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#36393f] flex items-center gap-3 border-t border-black/5">
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            <div className="w-10 h-10 bg-[#40444b] rounded-full flex items-center justify-center text-xl text-gray-400 hover:text-white transition-all">＋</div>
          </label>
          <input 
            className="flex-1 bg-[#40444b] p-3 rounded-xl outline-none text-sm text-white" 
            placeholder="메시지를 입력하세요..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </form>
      </div>

      {/* 모달: 관리자용 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl">
            <h3 className="font-bold text-xl mb-6 text-center text-[#5865f2]">관리 모드</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm outline-none border border-black/20" value={editName} onChange={e => setEditName(e.target.value)} placeholder="닉네임 변경" />
              <button onClick={() => updateNickname(selectedUser.id)} className="w-full bg-[#5865f2] py-2 rounded-lg text-xs font-bold">변경 적용</button>
              <div className="flex gap-2">
                <button onClick={() => adminAction('mute', selectedUser.id)} className="flex-1 bg-yellow-500 text-black py-2 rounded-lg font-bold text-xs">정지</button>
                <button onClick={() => adminAction('unmute', selectedUser.id)} className="flex-1 bg-green-600 py-2 rounded-lg font-bold text-xs">해제</button>
              </div>
              <button onClick={() => setSelectedUser(null)} className="w-full text-xs text-gray-500 pt-2">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 내 설정 */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl">
            <h3 className="font-bold text-xl mb-6 text-center">내 정보 수정</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm outline-none" value={editName} onChange={e => setEditName(e.target.value)} placeholder="새 닉네임" />
              <div className="flex gap-2">
                <button onClick={() => updateNickname(currentUser.id)} className="flex-1 bg-[#5865f2] py-2 rounded-lg font-bold">저장</button>
                <button onClick={() => setShowMySettings(false)} className="flex-1 bg-gray-700 py-2 rounded-lg">취도</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}