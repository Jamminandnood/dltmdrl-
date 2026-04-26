"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";

export default function ChatPage() {
  const [isClient, setIsClient] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [myNickname, setMyNickname] = useState("");
  const [myRole, setMyRole] = useState("user");
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const channelRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nick = (user.user_metadata?.display_name || user.email?.split("@")[0] || "익명").trim();
      setMyNickname(nick);

      // 1. 프로필 정보 로드
      const { data: profiles } = await supabase.from("profiles").select("nickname, role");
      if (profiles) {
        setAllUsers(profiles.map(p => ({ ...p, nickname: p.nickname.trim() })));
        const myProfile = profiles.find(p => p.nickname.trim() === nick);
        if (myProfile) setMyRole(myProfile.role);
      }

      // 2. 초기 메시지 로드
      const { data } = await supabase.from("messages").select("*").order("created_at", { ascending: true });
      if (data) setMessages(data);

      // 3. 실시간 채널 및 Presence 설정
      const channel = supabase.channel("global_chat", {
        config: { presence: { key: nick } }
      });

      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (p) => {
          if (p.eventType === "INSERT") setMessages(prev => [...prev, p.new]);
          if (p.eventType === "DELETE") setMessages(prev => prev.filter(m => m.id !== p.old.id));
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const names = Object.keys(state).map(k => k.trim());
          setOnlineUsers([...new Set(names)]);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ online_at: new Date().toISOString() });
          }
        });

      channelRef.current = channel;
    };

    setup();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  // 이미지 업로드 로직
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      await supabase.from("messages").insert([{ 
        content: `[IMAGE]:${publicUrl}`, 
        sender_nickname: myNickname, 
        room_id: "1" 
      }]);

    } catch (error: any) {
      alert("업로드 실패: " + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteMessage = async (id: string) => {
    if (myRole !== "admin") return;
    await supabase.from("messages").delete().eq("id", id);
  };

  useEffect(() => {
    if (isClient) scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isClient]);

  // 하이드레이션 에러 방지 (클라이언트 렌더링 강제)
  if (!isClient) return <div className="h-screen bg-[#313338]" />;

  return (
    <div className="flex h-screen bg-[#313338] text-[#dbdee1] overflow-hidden" suppressHydrationWarning>
      {/* 사이드바 */}
      <div className="w-64 bg-[#2b2d31] flex flex-col border-r border-[#1e1f22] shrink-0">
        <div className="p-4 font-bold text-white border-b border-[#1e1f22]">승기베스트</div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-bold text-[#949ba4] px-2 py-2 uppercase">온라인 — {onlineUsers.length}</div>
          {allUsers.filter(u => onlineUsers.includes(u.nickname)).map((u, i) => (
            <div key={`on-${i}`} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[#35373c]">
              <div className="w-8 h-8 bg-[#5865f2] rounded-full flex items-center justify-center text-[10px] font-bold text-white relative shrink-0">
                {u.nickname[0]}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#23a55a] border-2 border-[#2b2d31] rounded-full"></div>
              </div>
              <div className="text-sm truncate font-medium flex items-center gap-1">
                {u.nickname} {u.role === "admin" && "👑"}
              </div>
            </div>
          ))}
          <div className="text-xs font-bold text-[#949ba4] px-2 py-2 mt-6 uppercase">오프라인</div>
          {allUsers.filter(u => !onlineUsers.includes(u.nickname)).map((u, i) => (
            <div key={`off-${i}`} className="flex items-center gap-3 px-2 py-1.5 opacity-50 grayscale transition-opacity">
              <div className="w-8 h-8 bg-[#4e5058] rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{u.nickname[0]}</div>
              <div className="text-sm truncate flex items-center gap-1">{u.nickname} {u.role === "admin" && "👑"}</div>
            </div>
          ))}
        </div>
        <div className="p-2 bg-[#232428] flex items-center gap-3 border-t border-[#1e1f22]">
          <div className="w-8 h-8 bg-[#eb459e] rounded-full flex items-center justify-center font-bold text-white uppercase shrink-0">{myNickname?.[0]}</div>
          <div className="flex-1 min-w-0 font-bold text-white truncate">{myNickname} {myRole === "admin" && "👑"}</div>
        </div>
      </div>

      {/* 메인 채팅 섹션 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-[#1e1f22] flex items-center px-4 font-bold text-white shadow-sm"># 전체 채팅방</div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="flex gap-4 px-4 py-1 hover:bg-[#2e3035] rounded-lg group relative transition-colors">
              <div className="w-10 h-10 bg-[#4e5058] rounded-full flex items-center justify-center font-bold text-white uppercase shrink-0">{m.sender_nickname?.[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{m.sender_nickname}</span>
                  <span className="text-[10px] text-[#949ba4]" suppressHydrationWarning>{new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {m.content.startsWith("[IMAGE]:") ? (
                  <img src={m.content.split("[IMAGE]:")[1]} alt="img" className="mt-2 max-w-[300px] rounded-lg border border-[#1e1f22] hover:scale-[1.01] transition-transform cursor-pointer" />
                ) : (
                  <p className="text-[#dbdee1] break-all leading-relaxed">{m.content}</p>
                )}
              </div>
              {myRole === "admin" && (
                <button onClick={() => deleteMessage(m.id)} className="hidden group-hover:block absolute right-4 top-2 text-xs text-[#ed4245] border border-[#ed4245] px-2 py-1 rounded hover:bg-[#ed4245] hover:text-white transition-all">삭제</button>
              )}
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* 하단 입력바 (수정됨) */}
        <div className="p-4 bg-[#313338]">
          <div className="bg-[#383a40] rounded-xl flex items-center px-4 gap-3">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[#b5bac1] hover:text-white text-2xl font-light p-1"
              disabled={isUploading}
            >
              {isUploading ? "..." : "+"}
            </button>
            <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleImageUpload} />
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!inputText.trim()) return;
              await supabase.from("messages").insert([{ content: inputText.trim(), sender_nickname: myNickname, room_id: "1" }]);
              setInputText("");
            }} className="flex-1">
              <input 
                type="text" 
                className="w-full bg-transparent py-4 outline-none text-[#dbdee1] text-sm" 
                placeholder="#전체 채팅방에 메시지 보내기" 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
              />
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}