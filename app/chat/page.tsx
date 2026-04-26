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
      fetchMessages(); // 초기 데이터 로드

      const channel = supabase.channel('chat_room_final')
        .on('postgres_changes' as any, { event: '*', table: 'messages', schema: 'public' }, (payload: any) => {
          console.log("실시간 변화 감지:", payload);
          fetchMessages();
        })
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

  const fetchMessages = async () => {
    // [해결] 쿼리를 가장 단순하게 변경하여 데이터가 없으면 빈 배열이라도 가져오게 함
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(nickname, email)')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error("Fetch Error:", error);
      return;
    }
    
    // 데이터가 있으면 상태 업데이트
    setMessages(data || []);
    
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
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

    // [중요] room_id 에러 방지를 위해 필요한 필드만 전송
    const insertData: any = { 
      content, 
      user_id: currentUser.id 
    };
    if (imageUrl) insertData.image_url = imageUrl;

    const { error } = await supabase.from('messages').insert([insertData]);

    if (error) {
      console.error("전송 에러 세부사항:", error);
      alert("전송 실패: " + error.message + "\n(room_id 관련 에러일 경우 DB 설정을 확인해야 합니다)");
    } else {
      setInputText('');
      fetchMessages(); // 전송 후 즉시 로컬 갱신
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('chat-images').upload(fileName, file);
    if (error) return alert("이미지 업로드 실패: " + error.message);
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
      alert("처리 완료");
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
      <div className="w-64 bg-[#202227] flex flex-col border-r border-black/20 shrink-0">
        <div className="p-4 font-bold text-xl border-b border-black/10 text-[#5865f2] tracking-tighter">SERVER LOG</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div>
            <h3 className="text-[10px] font-bold text-green-500 mb-2 uppercase tracking-widest opacity-80">● 온라인</h3>
            {users.filter(u => u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer text-sm flex justify-between items-center group transition-colors">
                <span className="truncate group-hover:text-[#5865f2] transition-colors">{u.nickname || u.email?.split('@')[0]}</span>
                {u.is_admin && <span className="text-[9px] bg-yellow-500 text-black px-1 rounded font-bold uppercase ml-1">Admin</span>}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest opacity-80">○ 오프라인</h3>
            {users.filter(u => !u.is_online && !u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 text-gray-400 text-sm cursor-pointer hover:bg-white/5 rounded">
                {u.nickname || u.email?.split('@')[0]}
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-red-500 mb-2 uppercase tracking-widest opacity-80">禁 정지됨</h3>
            {users.filter(u => u.is_banned).map(u => (
              <div key={u.id} onClick={() => currentUser?.is_admin && setSelectedUser(u)} className="py-1.5 px-2 text-red-900/40 text-sm cursor-pointer line-through decoration-red-900/30">
                {u.nickname || u.email?.split('@')[0]}
              </div>
            ))}
          </div>
        </div>
        <div onClick={() => { setEditName(currentUser?.nickname || ''); setShowMySettings(true); }} className="p-3 bg-[#18191c] flex items-center gap-3 cursor-pointer hover:bg-[#2b2d31] transition-all border-t border-black/20 group">
          <div className="w-9 h-9 bg-[#5865f2] rounded-full flex items-center justify-center font-bold text-xs shadow-lg group-hover:scale-105 transition-transform">ME</div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate">{currentUser?.nickname || "사용자"}</p>
            <p className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors underline">설정</p>
          </div>
        </div>
      </div>

      {/* 메인 채팅창 */}
      <div className="flex-1 flex flex-col bg-[#36393f] relative overflow-hidden">
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-5 scroll-smooth custom-scrollbar">
          {/* 메시지 렌더링 로직 보강 */}
          {messages && messages.length > 0 ? (
            messages.map((m: any) => (
              <div key={m.id} className="group flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-[#5865f2] hover:underline cursor-pointer transition-all">
                    {m.profiles?.nickname || m.profiles?.email?.split('@')[0] || "익명 사용자"}
                  </span>
                  <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {m.content && (
                  <div className="bg-[#2e3037] p-3.5 rounded-r-2xl rounded-bl-2xl inline-block max-w-[80%] text-[14px] shadow-lg border border-black/10 leading-relaxed break-all">
                    {m.content}
                  </div>
                )}
                {m.image_url && (
                  <div className="mt-2 relative inline-block max-w-sm">
                    <img src={m.image_url} alt="upload" className="rounded-xl border border-black/20 shadow-2xl hover:brightness-110 transition-all cursor-zoom-in" />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-2 opacity-20">
              <div className="text-4xl animate-bounce">💬</div>
              <div className="text-sm italic">메시지가 아직 없습니다. 대화를 시작해 보세요.</div>
            </div>
          )}
        </div>

        {/* 하단 입력바 (플러스 버튼 포함) */}
        <div className="px-4 pb-6 pt-2 bg-[#36393f]">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-[#40444b] p-2 px-4 rounded-xl shadow-inner border border-black/5 focus-within:border-[#5865f2]/30 transition-all">
            <label className="cursor-pointer group relative">
              <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
              <div className="w-8 h-8 bg-[#b9bbbe] group-hover:bg-white rounded-full flex items-center justify-center text-xl text-[#36393f] font-bold transition-all active:scale-90 shadow-md">＋</div>
            </label>
            <input 
              className="flex-1 bg-transparent py-2 outline-none text-sm text-gray-100 placeholder-gray-500" 
              placeholder="메시지를 입력하세요..." 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
          </form>
        </div>
      </div>

      {/* 관리자 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="bg-[#202227] p-8 rounded-2xl w-80 border border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-in-center">
            <h3 className="font-bold text-xl mb-6 text-center text-[#5865f2] tracking-tighter uppercase">{selectedUser.nickname || "User"} Control</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-500 font-bold ml-1 uppercase">닉네임 강제 변경</p>
                <input className="w-full bg-[#1a1c20] p-3 rounded-xl text-sm outline-none border border-black/30 focus:border-[#5865f2] transition-all" value={editName} onChange={e => setEditName(e.target.value)} />
                <button onClick={() => updateNickname(selectedUser.id)} className="w-full mt-2 bg-[#5865f2] py-2.5 rounded-xl text-xs font-bold hover:bg-[#4752c4] active:scale-95 transition-all shadow-md">업데이트 실행</button>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => adminAction('mute', selectedUser.id)} className="flex-1 bg-yellow-500 text-black py-3 rounded-xl font-black text-[11px] hover:bg-yellow-400 active:scale-95 transition-all shadow-lg">10분 금지</button>
                <button onClick={() => adminAction('unmute', selectedUser.id)} className="flex-1 bg-green-600 py-3 rounded-xl font-black text-[11px] hover:bg-green-500 active:scale-95 transition-all shadow-lg">금지 해제</button>
              </div>
              <button onClick={() => adminAction(selectedUser.is_banned ? 'unban' : 'ban', selectedUser.id)} className={`w-full py-3 rounded-xl font-bold text-sm shadow-xl transition-all active:scale-95 ${selectedUser.is_banned ? 'bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}>
                {selectedUser.is_banned ? '차단 해제' : '영구 서버 차단'}
              </button>
              <button onClick={() => setSelectedUser(null)} className="w-full text-xs text-gray-500 hover:text-white transition-colors pt-2 text-center uppercase tracking-widest font-bold">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 내 설정 모달 */}
      {showMySettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="bg-[#202227] p-8 rounded-3xl w-80 shadow-2xl border border-white/5">
            <h3 className="font-bold text-xl mb-6 text-center text-[#5865f2]">프로필 설정</h3>
            <div className="space-y-4">
              <input className="w-full bg-[#1a1c20] p-4 rounded-2xl text-sm outline-none border border-black/20 focus:border-[#5865f2] transition-all" placeholder="새 닉네임" value={editName} onChange={e => setEditName(e.target.value)} />
              <div className="flex gap-2">
                <button onClick={() => updateNickname(currentUser.id)} className="flex-1 bg-[#5865f2] py-3 rounded-xl font-bold hover:bg-[#4752c4] active:scale-95 transition-all">저장</button>
                <button onClick={() => setShowMySettings(false)} className="flex-1 bg-gray-700 py-3 rounded-xl font-bold active:scale-95 transition-all">취소</button>
              </div>
              <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="w-full mt-4 py-2 text-xs text-red-500 font-bold hover:bg-red-500/10 rounded-xl transition-all">로그아웃</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}