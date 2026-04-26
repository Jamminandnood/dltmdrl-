'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null); // 클릭한 사용자 모달용
  const [newNickname, setNewNickname] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUserAndProfiles();
  }, []);

  // 유저 정보 및 전체 프로필 가져오기
  const fetchUserAndProfiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/');

    // 내 프로필 가져오기 (is_admin 포함)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setCurrentUser({ ...user, ...profile });

    // 전체 유저 목록 가져오기
    const { data: allUsers } = await supabase.from('profiles').select('*');
    if (allUsers) setUsers(allUsers);
    setLoading(false);
  };

  // 1. 로그아웃 기능
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // 2. 닉네임 변경 기능
  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) return alert('닉네임을 입력해주세요.');
    const { error } = await supabase
      .from('profiles')
      .update({ nickname: newNickname })
      .eq('id', currentUser.id);

    if (error) alert('변경 실패: ' + error.message);
    else {
      alert('닉네임이 변경되었습니다!');
      fetchUserAndProfiles(); // 정보 갱신
      setNewNickname('');
    }
  };

  // 3. 관리자 액션 (정지, 뮤트)
  const handleAdminAction = async (type: 'ban' | 'mute', targetId: string) => {
    if (!currentUser?.is_admin) return alert('권한이 없습니다.');

    let updateData = {};
    if (type === 'ban') {
      updateData = { is_banned: true };
    } else if (type === 'mute') {
      // 10분 뒤까지 채팅 금지
      const muteUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      updateData = { mute_until: muteUntil };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', targetId);

    if (error) alert('작업 실패: ' + error.message);
    else {
      alert('처리가 완료되었습니다.');
      setSelectedUser(null);
      fetchUserAndProfiles(); // 목록 갱신
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#1a1c20] text-white">로딩 중...</div>;

  return (
    // image_2.png의 배경색 적용
    <div className="flex h-screen bg-[#1a1c20] text-white font-sans">
      {/* 왼쪽 사이드바 (깔끔한 다크 스타일) */}
      <div className="w-72 flex flex-col border-r border-gray-800 bg-[#202227] p-5">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* RC 로고 아이콘 */}
            <div className="w-10 h-10 bg-[#5865f2] rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg">RC</div>
            <h2 className="text-2xl font-extrabold tracking-tight">Realtime<br/>Chat</h2>
          </div>
        </div>

        {/* 내 프로필 설정 박스 (image_2.png 스타일 버튼/인풋 적용) */}
        <div className="mb-8 rounded-xl bg-[#2b2d35] p-4 shadow-inner">
          <p className="text-xs text-gray-400 mb-3">내 프로필 설정</p>
          <div className="flex flex-col gap-2">
            <input 
              className="w-full bg-[#e8f0fe] p-2.5 text-sm rounded-lg text-black outline-none transition focus:ring-2 focus:ring-[#5865f2]"
              placeholder={currentUser?.nickname || "새 닉네임 입력"}
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleUpdateNickname} className="flex-1 bg-[#5865f2] py-2 rounded-lg text-sm font-bold hover:bg-[#4752c4] transition shadow">변경</button>
              <button onClick={handleLogout} className="flex-1 bg-[#36373d] py-2 rounded-lg text-sm font-bold hover:bg-[#404249] transition">로그아웃</button>
            </div>
          </div>
        </div>

        {/* 접속자 리스트 */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="mb-4 text-xs font-bold text-gray-500 uppercase tracking-wider">접속자 목록 (클릭 시 관리)</h3>
          <ul className="space-y-2">
            {users.map((user) => (
              <li 
                key={user.id} 
                onClick={() => setSelectedUser(user)}
                className={`flex cursor-pointer items-center justify-between rounded-lg p-3 transition ${selectedUser?.id === user.id ? 'bg-[#36373d]' : 'hover:bg-[#2b2d35]'}`}
              >
                <span className={`font-medium ${user.is_banned ? "text-gray-600 line-through" : "text-gray-200"}`}>
                  {user.nickname || user.email.split('@')[0]}
                </span>
                {user.is_admin && <span className="rounded-full bg-[#f1c40f] px-2 py-0.5 text-[10px] font-bold text-black shadow">ADMIN</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 중앙: 채팅 영역 (기존 채팅 메시지 코드를 여기에 유지하세요) */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#1a1c20]">
        {/* 승기님의 원래 채팅 메시지 map 코드를 여기에 넣으세요! */}
        <p className="text-gray-600 text-lg">채팅 메시지 영역 (기존 코드 유지 필수)</p>
      </div>

      {/* 관리자 팝업 모달 (image_2.png 스타일 적용) */}
      {selectedUser && currentUser?.is_admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-sm">
          <div className="w-80 rounded-2xl bg-[#202227] p-7 shadow-2xl border border-gray-800">
            <h3 className="mb-1 text-2xl font-extrabold">{selectedUser.nickname || selectedUser.email}</h3>
            <p className="mb-7 text-sm text-gray-400">사용자 관리 메뉴</p>
            
            <div className="flex flex-col gap-3">
              <button onClick={() => handleAdminAction('mute', selectedUser.id)} className="w-full rounded-lg bg-[#f1c40f] py-3 font-bold text-black hover:bg-[#d4ac0d] transition shadow">10분 채팅 금지</button>
              <button onClick={() => handleAdminAction('ban', selectedUser.id)} className="w-full rounded-lg bg-[#e74c3c] py-3 font-bold hover:bg-[#c0392b] transition shadow">계정 영구 정지</button>
              <button onClick={() => setSelectedUser(null)} className="mt-3 w-full py-2 text-sm text-gray-500 hover:text-white transition">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}