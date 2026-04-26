'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null); // 관리자용 모달 대상
  const [showMySettings, setShowMySettings] = useState(false); // 내 이름 변경 모달
  const [editName, setEditName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser({ ...user, ...profile });
      
      fetchInitialData();

      // Realtime 구독 - image_55907f.png 에러 해결 (타입 안전한 방식)
      const channel = supabase.channel('room_1')
        .on('postgres_changes' as any, { event: '*', table: 'messages', schema: 'public' }, () => fetchMessages())
        .on('postgres_changes' as any, { event: '*', table: 'profiles', schema: 'public' }, () => fetchUsers())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };
    init();
  }, []);

  const fetchInitialData = () => { fetchMessages(); fetchUsers(); };

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*, profiles(nickname, id)').order('created_at', { ascending: true });
    if (data) setMessages(data);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
  };

  // --- 메시지 및 이미지 기능 ---
  const handleSendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !imageUrl) return;

    const { error } = await supabase.from('messages').insert([
      { content: inputText, user_id: currentUser.id, image_url: imageUrl || null }
    ]);
    if (error) alert("전송 실패: " + error.message);
    else setInputText('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      handleSendMessage(undefined, publicUrl);
    } else alert("업로드 실패: " + error.message);
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from('messages').delete().eq('id', msgId);
    fetchMessages();
  };

  // --- 사용자 관리 기능 ---
  const handleUpdateName = async (targetId: string) => {
    if (!editName.trim()) return alert("이름을 입력하세요.");
    const { error } = await supabase.from('profiles').update({ nickname: editName }).eq('id', targetId);
    if (!error) {
      alert("변경 성공");
      setEditName('');
      window.location.reload();
    }
  };

  const adminAction = async (type: 'ban' | 'mute', targetId: string) => {
    const update = type === 'ban' ? { is_banned: true } : { mute_until: new Date(Date.now() + 600000).toISOString() };
    await supabase.from('profiles').update(update).eq('id', targetId);
    alert("완료");
    setSelectedUser(null);
    fetchUsers();
  };

  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden">
      {/* 사이드바 - 사용자 목록 3단계 구분 */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10">Realtime Chat</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-[10px] font-bold text-green-500 mb-3 uppercase tracking-tighter">● 온라인</h3>
            {users.filter(u => !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer flex justify-between items-center text-sm">
                <span>{u.nickname || u.email.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">ADMIN</span>}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 mb-3 uppercase tracking-tighter">○ 오프라인</h3>
            <p className="text-[10px] text-gray-700 px-2 italic">현재 오프라인인 사용자가 없습니다.</p>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-red-500 mb-3 uppercase tracking-tighter">禁 정지됨</h3>
            {users.filter(u => u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 text-gray-600 text-sm hover:bg-white/5 rounded cursor-pointer line-through">
                {u.nickname || u.email.split('@')[0]}
              </div>
            ))}
          </div>
        </div>

        {/* 왼쪽 하단 프로필 - 클릭 시 내 이름 변경 */}
        <div onClick={() => setShowMySettings(true)} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer hover:bg-[#2b2d31] transition border-t border-black/20">
          <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center text-xs font-bold">RC</div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-bold truncate">{currentUser?.nickname || "사용자"}</div>
            <div className="text-[10px] text-gray-500">프로필 설정</div>
          </div>
        </div>
      </div>

      {/* 중앙 메시지 영역 */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-5">
          {messages.map((m: any) => (
            <div key={m.id} className="group flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#5865f2]">{m.profiles?.nickname || "익명 사용자"}</span>
                <span className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleTimeString()}</span>
                {(currentUser?.id === m.user_id || currentUser?.is_admin) && (
                  <button onClick={() => handleDeleteMessage(m.id)} className="hidden group-hover:block text-[10px] text-red-400 hover:underline transition">삭제</button>
                )}
              </div>
              {m.content && <div className="bg-[#2e3037] p-3 rounded-r-xl rounded-bl-xl inline-block max-w-[75%] text-sm shadow-sm">{m.content}</div>}
              {m.image_url && <img src={m.image_url} alt="upload" className="mt-2 rounded-lg max-w-sm border border-gray-800 shadow-md" />}
            </div>
          ))}
        </div>
        
        {/* 입력창 */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#36393f] flex items-center gap-3 border-t border-white/5">
          <label className="text-gray-400 hover:text-white transition cursor-pointer px-2">
            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            <span className="text-2xl">＋</span>
          </label>
          <input 
            className="flex-1 bg-[#40444b] p-3 rounded-xl outline-none text-sm focus:ring-1 focus:ring-[#5865f2] transition" 
            placeholder="메시지를 입력하세요..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </form>
      </div>

      {/* 모달: 내 설정 (닉네임 변경) */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl">
            <h3 className="font-bold text-xl mb-4 text-white font-mono tracking-tighter">SETTINGS</h3>
            <input className="w-full bg-[#1a1c20] p-3 rounded-lg mb-4 text-sm outline-none border border-gray-700" placeholder="새 닉네임" onChange={e => setEditName(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => handleUpdateName(currentUser.id)} className="flex-1 bg-[#5865f2] py-2.5 rounded-lg font-bold text-sm">변경</button>
              <button onClick={() => setShowMySettings(false)} className="flex-1 bg-gray-700 py-2.5 rounded-lg text-sm text-gray-300">닫기</button>
            </div>
            <button onClick={() => {supabase.auth.signOut(); router.push('/')}} className="w-full mt-6 text-[10px] text-red-500 hover:underline">로그아웃</button>
          </div>
        </div>
      )}

      {/* 모달: 관리자 메뉴 (사용자 클릭 시) */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 shadow-2xl">
            <h3 className="font-bold text-xl mb-1">{selectedUser.nickname || "사용자"}</h3>
            <p className="text-[10px] text-gray-500 mb-6 uppercase">Admin Control Panel</p>
            <div className="space-y-4">
              <div>
                <input className="w-full bg-[#1a1c20] p-3 rounded-lg text-sm mb-2 outline-none" placeholder="이름 강제 변경" onChange={e => setEditName(e.target.value)} />
                <button onClick={() => handleUpdateName(selectedUser.id)} className="w-full bg-blue-600 py-2.5 rounded-lg text-sm font-bold">이름 업데이트</button>
              </div>
              <div className="h-[1px] bg-gray-800 my-2" />
              <button onClick={() => adminAction('mute', selectedUser.id)} className="w-full bg-yellow-500 text-black py-2.5 rounded-lg text-sm font-bold">10분 채팅 금지</button>
              <button onClick={() => adminAction('ban', selectedUser.id)} className="w-full bg-red-600 py-2.5 rounded-lg text-sm font-bold">정지 / 해제</button>
              <button onClick={() => setSelectedUser(null)} className="w-full mt-2 text-xs text-gray-500 hover:text-white transition">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}