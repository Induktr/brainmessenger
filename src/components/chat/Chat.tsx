import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ChatMember {
  chat_id: string;
  user_id: string;
  joined_at: string;
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export const Chat = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchChatMembers = async () => {
    try {
      setLoading(true);
      const { data: chatMembers, error } = await supabase
        .from('chat_members')
        .select('chat_id, user_id, joined_at')
        .throwOnError();

      if (error) throw error;

      if (!chatMembers) {
        setMembers([]);
        return;
      }

      const userIds = chatMembers.map(member => member.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)
        .throwOnError();

      if (profilesError) throw profilesError;

      const membersWithProfiles = chatMembers.map(member => ({
        ...member,
        profile: profiles?.find(profile => profile.id === member.user_id) || null
      }));

      setMembers(membersWithProfiles);
    } catch (err) {
      console.error('Error in fetchChatMembers:', err);
      toast.error('Failed to load chat members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
      } else {
        fetchChatMembers();
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-semibold mb-4">BrainMessenger</h1>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="p-4 text-muted-foreground">
              No chats found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div 
                  key={`${member.chat_id}-${member.user_id}`}
                  className="flex items-center space-x-3 p-4 hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-shrink-0">
                    {member.profile?.avatar_url ? (
                      <img 
                        src={member.profile.avatar_url} 
                        alt={member.profile.display_name || 'User avatar'}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">
                          {member.profile?.display_name?.[0] || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.profile?.display_name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      Click to start chatting
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex items-center justify-center bg-accent/5">
        <div className="text-center">
          <p className="text-muted-foreground">
            Select a chat to start messaging
          </p>
        </div>
      </div>
    </div>
  );
};