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
      
      fetchUsers();
      fetchMessages();

      // 실시간 메시지 구독
      const channel = supabase.channel('realtime-chat')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
          fetchMessages();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };
    init();
  }, []);

  // 메시지 및 유저 정보 불러오기
  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*, profiles(nickname, id)').order('created_at', { ascending: true });
    if (data) setMessages(data);
    setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 100);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setUsers(data);
  };

  // --- 기능 함수들 ---

  const sendMessage = async (e?: React.FormEvent, imageUrl?: string) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !imageUrl) return;

    const { error } = await supabase.from('messages').insert([
      { content: inputText, user_id: currentUser.id, image_url: imageUrl || null }
    ]);

    if (!error) setInputText('');
    else alert("전송 실패: " + error.message);
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm("메시지를 삭제하시겠습니까?")) return;
    await supabase.from('messages').delete().eq('id', msgId);
    fetchMessages();
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);

    if (data) {
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      sendMessage(undefined, publicUrl);
    } else {
      alert("이미지 업로드 실패: " + error.message);
    }
  };

  const adminAction = async (type: 'ban' | 'mute', targetId: string) => {
    let update = type === 'ban' ? { is_banned: true } : { mute_until: new Date(Date.now() + 600000).toISOString() };
    await supabase.from('profiles').update(update).eq('id', targetId);
    alert("처리 완료");
    setSelectedUser(null);
    fetchUsers();
  };

  const handleUpdateName = async (targetId: string) => {
    if (!editName.trim()) return;
    await supabase.from('profiles').update({ nickname: editName }).eq('id', targetId);
    alert("이름 변경 완료");
    window.location.reload();
  };

  return (
    <div className="flex h-screen bg-[#1a1c20] text-white overflow-hidden font-sans">
      {/* 사이드바 (사용자 목록) */}
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20">
        <div className="p-4 font-bold text-xl border-b border-black/10">Realtime Chat</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">온라인 사용자</h3>
            {users.filter(u => !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer flex justify-between items-center text-sm">
                <span>{u.nickname || u.email.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold">ADMIN</span>}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">정지됨</h3>
            {users.filter(u => u.is_banned).map(u => (
              <div key={u.id} className="py-1.5 px-2 text-gray-600 text-sm italic">{u.nickname || u.email.split('@')[0]}</div>
            ))}
          </div>
        </div>
        {/* 내 정보 (왼쪽 아래) */}
        <div onClick={() => setShowMySettings(true)} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer hover:bg-[#2b2d31]">
          <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center text-xs font-bold font-mono">RC</div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-bold truncate">{currentUser?.nickname || "내 이름"}</div>
            <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Online</div>
          </div>
        </div>
      </div>

      {/* 중앙 메시지창 */}
      <div className="flex-1 flex flex-col bg-[#36393f]">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m: any) => (
            <div key={m.id} className="group flex flex-col animate-fadeIn relative">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#5865f2]">{m.profiles?.nickname || "익명"}</span>
                <span className="text-[10px] text-gray-500">{new Date(m.created_at).toLocaleTimeString()}</span>
                {(currentUser?.id === m.user_id || currentUser?.is_admin) && (
                  <button onClick={() => deleteMessage(m.id)} className="hidden group-hover:block text-xs text-red-400 ml-2">삭제</button>
                )}
              </div>
              {m.content && <div className="bg-[#2e3037] p-3 rounded-r-xl rounded-bl-xl inline-block max-w-[80%] text-sm">{m.content}</div>}
              {m.image_url && <img src={m.image_url} alt="upload" className="mt-2 rounded-lg max-w-xs border border-gray-700" />}
            </div>
          ))}
        </div>
        {/* 입력창 (사진 전송 아이콘 포함) */}
        <form onSubmit={sendMessage} className="p-4 bg-[#36393f] flex items-center gap-3">
          <label className="cursor-pointer hover:text-white text-gray-400">
            <input type="file" className="hidden" onChange={uploadImage} accept="image/*" />
            <span className="text-2xl font-bold">+</span>
          </label>
          <input 
            className="flex-1 bg-[#40444b] p-3 rounded-xl outline-none text-sm" 
            placeholder="메시지를 입력하세요..." 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
        </form>
      </div>

      {/* 모달창들 (내 설정 및 관리자 메뉴) */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#202227] p-8 rounded-2xl w-80">
            <h3 className="font-bold text-xl mb-4 text-white">내 닉네임 변경</h3>
            <input className="w-full bg-[#1a1c20] p-3 rounded-lg mb-4 text-sm" placeholder="새 닉네임" onChange={e => setEditName(e.target.value)} />
            <button onClick={() => handleUpdateName(currentUser.id)} className="w-full bg-[#5865f2] py-2.5 rounded-lg font-bold mb-2 text-sm">변경</button>
            <button onClick={() => setShowMySettings(false)} className="w-full text-gray-500 text-sm">취소</button>
          </div>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#202227] p-8 rounded-2xl w-80">
            <h3 className="font-bold text-xl mb-4">{selectedUser.nickname} 관리</h3>
            <input className="w-full bg-[#1a1c20] p-3 rounded-lg mb-2 text-sm" placeholder="이름 강제 변경" onChange={e => setEditName(e.target.value)} />
            <button onClick={() => handleUpdateName(selectedUser.id)} className="w-full bg-blue-600 py-2.5 rounded-lg mb-4 text-sm font-bold">이름 업데이트</button>
            <button onClick={() => adminAction('mute', selectedUser.id)} className="w-full bg-yellow-500 text-black py-2 rounded-lg font-bold mb-2">10분 금지</button>
            <button onClick={() => adminAction('ban', selectedUser.id)} className="w-full bg-red-600 py-2 rounded-lg font-bold mb-4">정지</button>
            <button onClick={() => setSelectedUser(null)} className="w-full text-gray-500">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}