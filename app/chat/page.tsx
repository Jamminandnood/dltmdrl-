'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newNickname, setNewNickname] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchUserAndProfiles();
  }, []);

  const fetchUserAndProfiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCurrentUser({ ...user, ...profile });

    const { data: allUsers } = await supabase.from('profiles').select('*');
    if (allUsers) setUsers(allUsers);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) return alert('닉네임을 입력해주세요.');
    const { error } = await supabase.from('profiles').update({ nickname: newNickname }).eq('id', currentUser.id);
    if (error) alert('변경 실패');
    else { alert('닉네임 변경 완료!'); window.location.reload(); }
  };

  const handleAdminAction = async (type: 'ban' | 'mute', targetId: string) => {
    let updateData = {};
    if (type === 'ban') updateData = { is_banned: true };
    else if (type === 'mute') updateData = { mute_until: new Date(Date.now() + 10 * 60 * 1000).toISOString() };

    const { error } = await supabase.from('profiles').update(updateData).eq('id', targetId);
    if (error) alert('실패');
    else { alert('처리 완료'); setSelectedUser(null); fetchUserAndProfiles(); }
  };

  if (loading) return <div className="p-4">로딩 중...</div>;

  return (
    <div className="flex h-screen bg-white text-black">
      {/* 왼쪽 사이드바 (예전 스타일) */}
      <div className="w-64 border-r border-gray-300 flex flex-col p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">접속자</h2>
          <button onClick={handleLogout} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">로그아웃</button>
        </div>

        {/* 닉네임 변경 */}
        <div className="mb-6">
          <input 
            className="border p-1 text-sm w-full mb-1" 
            placeholder="새 닉네임" 
            onChange={(e) => setNewNickname(e.target.value)} 
          />
          <button onClick={handleUpdateNickname} className="text-xs text-blue-500 underline">닉네임 변경</button>
        </div>

        <ul className="space-y-1 overflow-y-auto">
          {users.map((user) => (
            <li 
              key={user.id} 
              onClick={() => setSelectedUser(user)}
              className="cursor-pointer hover:bg-gray-200 p-2 rounded text-sm flex justify-between"
            >
              <span>{user.nickname || user.email.split('@')[0]}</span>
              {user.is_admin && <span className="text-[10px] bg-yellow-200 px-1 rounded">관리자</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* 중앙 채팅 영역 (기존 코드 유지) */}
      <div className="flex-1 flex flex-col">
        {/* 여기에 승기님이 원래 쓰시던 채팅 메시지 출력 코드를 넣으세요! */}
        <div className="flex-1 p-4 overflow-y-auto">
           <p className="text-gray-400">채팅 메시지가 표시되는 곳입니다.</p>
        </div>
      </div>

      {/* 관리자 메뉴 모달 */}
      {selectedUser && currentUser?.is_admin && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white p-6 rounded border shadow-xl w-64">
            <h3 className="font-bold mb-4">{selectedUser.nickname || selectedUser.email} 관리</h3>
            <button onClick={() => handleAdminAction('mute', selectedUser.id)} className="w-full mb-2 bg-yellow-100 py-2 text-sm">10분 금지</button>
            <button onClick={() => handleAdminAction('ban', selectedUser.id)} className="w-full mb-2 bg-red-100 py-2 text-sm">영구 정지</button>
            <button onClick={() => setSelectedUser(null)} className="w-full py-2 text-xs text-gray-500">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}