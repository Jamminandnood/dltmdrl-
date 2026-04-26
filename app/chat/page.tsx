'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showMySettings, setShowMySettings] = useState(false);
  const [editName, setEditName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ ...user, ...profile });

      await supabase.from('profiles').update({ is_online: true }).eq('id', user.id);
      
      fetchUsers();
      fetchMessages();

      // [해결] TypeScript 타입 에러 방지를 위해 as any 사용 및 채널 연결
      const channel = supabase.channel('chat_main')
        .on('postgres_changes' as any, { event: '*', table: 'messages', schema: 'public' }, () => fetchMessages())
        .on('postgres_changes' as any, { event: '*', table: 'profiles', schema: 'public' }, () => fetchUsers())
        .subscribe();

      const setOffline = () => supabase.from('profiles').update({ is_online: false }).eq('id', user.id).then();
      window.addEventListener('beforeunload', setOffline);
      return () => {
        setOffline();
        window.removeEventListener('beforeunload', setOffline);
        supabase.removeChannel(channel);
      };
    };
    init();
  }, []);

  // [중요] 메시지 로딩 로직 - profiles가 없어도 빈 객체라도 반환하도록 설정
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(nickname, email, id)')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error("데이터 로드 실패:", error.message);
      return;
    }
    
    if (data) {
      setMessages(data);
      // 스크롤 하단 이동
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
  };

  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content && !imageUrl) return;

    if (currentUser?.mute_until && new Date(currentUser.mute_until) > new Date()) {
      alert("채팅 금지 상태입니다.");
      return;
    }

    const { error } = await supabase.from('messages').insert([
      { content, user_id: currentUser.id, image_url: imageUrl || null }
    ]);

    if (error) {
      // room_id 에러(image_54b2a5.png) 발생 시 null 허용 정책 확인 필요
      alert("전송 실패: " + error.message);
    } else {
      setInputText('');
      fetchMessages();
    }
  };

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

  const adminAction = async (type: 'ban' | 'mute' | 'unmute' | 'unban', targetId: string) => {
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

  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden font-sans">
      {/* 사이드바 */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10 text-[#5865f2]">CHAT ROOM</div>
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
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">○ OFFLINE</h3>
            {users.filter(u => !u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 text-gray-400 text-sm cursor-pointer hover:bg-white/5 rounded">
                {u.nickname || u.email?.split('@')[0]}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-red-500 mb-2 uppercase tracking-widest">禁 BANNED</h3>
            {users.filter(u => u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 text-red-900/50 text-sm cursor-pointer line-through">
                {u.nickname || u.email?.split('@')[0]}
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => { setEditName(currentUser?.nickname || ''); setShowMySettings(true); }} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer hover:bg-[#2b2d31] transition border-t border-black/20">
          <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center font-bold text-xs shadow-lg">ME</div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser?.nickname || "사용자"}</p>
            <p className="text-[10px] text-gray-500 underline">설정 및 이름 변경</p>
          </div>
        </div>
      </div>

      {/* 메인 채팅창 - 이 영역이 비어있지 않도록 보강함 */}
      <div className="flex-1 flex flex-col bg-[#36393f] relative">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">메시지가 없습니다.</div>
          )}
          {messages.map((m: any) => (
            <div key={m.id} className="group flex flex-col animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#5865f2]">
                  {/* [익명 방지] profiles 데이터가 없으면 '익명' 출력 */}
                  {m.profiles?.nickname || m.profiles?.email?.split('@')[0] || "익명"}
                </span>
                <span className="text-[10px] text-gray-500">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {m.content && (
                <div className="bg-[#2e3037] p-3 rounded-r-2xl rounded-bl-2xl inline-block max-w-[75%] text-[14px] shadow-md border border-black/5">
                  {m.content}
                </div>
              )}
              {m.image_url && (
                <img src={m.image_url} alt="upload" className="mt-2 rounded-xl max-w-sm border border-black/20 shadow-lg" />
              )}
            </div>
          ))}
        </div>

        {/* 하단 입력바 */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#36393f] flex items-center gap-3">
          <label className="cursor-pointer group">
            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            <div className="w-10 h-10 bg-[#40444b] rounded-full flex items-center justify-center text-xl text-gray-400 group-hover:bg-[#4e525a] group-hover:text-white transition-all shadow-md">＋</div>
          </label>
          <input 
            className="flex-1 bg-[#40444b] p-3 rounded-xl outline-none text-sm focus:bg-[#484c52] transition-all border border-transparent focus:border-[#5865f2]/20" 
            placeholder="메시지를 입력해 보세요..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </form>
      </div>

      {/* 관리자 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 border border-gray-800 shadow-2xl">
            <h3 className="font-bold text-xl mb-6 text-center text-[#5865f2]">{selectedUser.nickname || "관리"}</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm outline-none border border-black/20 focus:border-[#5865f2]" value={editName} onChange={e => setEditName(e.target.value)} placeholder="닉네임 변경" />
              <button onClick={() => updateNickname(selectedUser.id)} className="w-full bg-[#5865f2] py-2 rounded-lg text-xs font-bold hover:bg-[#4752c4]">이름 변경 적용</button>
              <div className="flex gap-2">
                <button onClick={() => adminAction('mute', selectedUser.id)} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-bold text-xs hover:bg-yellow-400">10분 정지</button>
                <button onClick={() => adminAction('unmute', selectedUser.id)} className="flex-1 bg-green-600 py-3 rounded-xl font-bold text-xs hover:bg-green-500">해제</button>
              </div>
              <button onClick={() => adminAction(selectedUser.is_banned ? 'unban' : 'ban', selectedUser.id)} className={`w-full py-3 rounded-xl font-bold text-sm ${selectedUser.is_banned ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}>
                {selectedUser.is_banned ? '차단 해제' : '영구 서버 차단'}
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-xs text-gray-500 text-center pt-2">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 내 설정 모달 */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl">
            <h3 className="font-bold text-xl mb-6 text-center">내 정보 설정</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm outline-none border border-black/20" placeholder="새 닉네임" value={editName} onChange={e => setEditName(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => updateNickname(currentUser.id)} className="flex-1 bg-[#5865f2] py-2.5 rounded-lg font-bold hover:bg-[#4752c4]">저장</button>
                <button onClick={() => setShowMySettings(false)} className="flex-1 bg-gray-700 py-2.5 rounded-lg">취소</button>
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="w-full mt-4 py-2 text-xs text-red-500 font-bold hover:bg-red-500/10 rounded-lg transition-colors">로그아웃</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}