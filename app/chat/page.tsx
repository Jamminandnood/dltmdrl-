'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null); // 클릭한 사용자 정보 저장
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

    // 내 상세 프로필(is_admin 포함) 가져오기
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

    if (error) {
      alert('변경 실패: ' + error.message);
    } else {
      alert('닉네임이 변경되었습니다!');
      window.location.reload(); // 변경사항 반영을 위해 새로고침
    }
  };

  // 3. 관리자 액션 (추방, 정지, 뮤트)
  const handleAdminAction = async (type: 'kick' | 'ban' | 'mute', targetId: string) => {
    if (!currentUser?.is_admin) return alert('관리자 권한이 없습니다.');

    let updateData = {};
    if (type === 'ban') {
      updateData = { is_banned: true };
    } else if (type === 'mute') {
      // 현재 시간으로부터 10분 뒤까지 채팅 금지
      const muteUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      updateData = { mute_until: muteUntil };
    } else if (type === 'kick') {
      // 추방은 사실상 접속을 끊는 것이므로 여기서는 간단히 안내만 하거나 
      // 특정 테이블에서 제거하는 로직을 넣을 수 있습니다.
      alert('추방 기능은 실시간 세션과 연동이 필요합니다. 현재는 UI만 구현되었습니다.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', targetId);

    if (error) {
      alert('작업 실패: ' + error.message);
    } else {
      alert('처리가 완료되었습니다.');
      setSelectedUser(null);
      fetchUserAndProfiles(); // 목록 새로고침
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">로딩 중...</div>;

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* 왼쪽 사이드바: 사용자 목록 */}
      <div className="w-72 flex flex-col border-r border-gray-700 bg-gray-800 p-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">채팅방</h2>
          <button onClick={handleLogout} className="rounded bg-red-600 px-3 py-1 text-xs hover:bg-red-700">로그아웃</button>
        </div>

        {/* 내 프로필 설정 */}
        <div className="mb-8 rounded-lg bg-gray-700 p-3">
          <p className="text-xs text-gray-400 mb-2">내 닉네임 설정</p>
          <div className="flex gap-2">
            <input 
              className="w-full bg-gray-600 p-1 text-sm rounded outline-none"
              placeholder={currentUser?.nickname || "닉네임 입력"}
              onChange={(e) => setNewNickname(e.target.value)}
            />
            <button onClick={handleUpdateNickname} className="text-xs text-blue-400 hover:text-blue-300">변경</button>
          </div>
        </div>

        {/* 접속자 리스트 */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="mb-3 text-sm font-semibold text-gray-400">사용자 목록 (클릭 시 관리)</h3>
          <ul className="space-y-2">
            {users.map((user) => (
              <li 
                key={user.id} 
                onClick={() => setSelectedUser(user)}
                className="flex cursor-pointer items-center justify-between rounded p-2 hover:bg-gray-700 transition"
              >
                <span className={user.is_banned ? "text-gray-500 line-through" : ""}>
                  {user.nickname || user.email.split('@')[0]}
                </span>
                {user.is_admin && <span className="rounded bg-yellow-600 px-1 text-[10px]">ADMIN</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 중앙: 채팅 영역 (기존 채팅 코드를 여기에 유지하세요) */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-gray-500">채팅 메시지 영역이 여기에 들어갑니다.</p>
      </div>

      {/* 관리자 팝업 모달 */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="w-80 rounded-lg bg-gray-800 p-6 shadow-2xl">
            <h3 className="mb-2 text-xl font-bold">{selectedUser.nickname || selectedUser.email}</h3>
            <p className="mb-6 text-sm text-gray-400">사용자 관리 메뉴</p>
            
            <div className="flex flex-col gap-3">
              {currentUser?.is_admin && (
                <>
                  <button onClick={() => handleAdminAction('mute', selectedUser.id)} className="w-full rounded bg-yellow-600 py-2 hover:bg-yellow-700">10분 채팅 금지</button>
                  <button onClick={() => handleAdminAction('ban', selectedUser.id)} className="w-full rounded bg-orange-600 py-2 hover:bg-orange-700">계정 영구 정지</button>
                  <button onClick={() => handleAdminAction('kick', selectedUser.id)} className="w-full rounded bg-red-600 py-2 hover:bg-red-700">강제 추방</button>
                </>
              )}
              <button onClick={() => setSelectedUser(null)} className="mt-2 w-full py-2 text-gray-400 hover:text-white">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}