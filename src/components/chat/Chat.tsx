import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

      // Fetch profiles in a single query
      const userIds = chatMembers.map(member => member.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)
        .throwOnError();

      if (profilesError) throw profilesError;

      // Map profiles to chat members
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Chat Members</h1>
      {members.length === 0 ? (
        <p className="text-muted-foreground">No chat members found.</p>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <div 
              key={`${member.chat_id}-${member.user_id}`}
              className="flex items-center space-x-4 p-4 bg-card rounded-lg shadow"
            >
              <div className="flex-shrink-0">
                {member.profile?.avatar_url && (
                  <img 
                    src={member.profile.avatar_url} 
                    alt={member.profile.display_name || 'User avatar'}
                    className="h-10 w-10 rounded-full"
                  />
                )}
              </div>
              <div>
                <p className="font-medium">{member.profile?.display_name || 'Unknown User'}</p>
                <p className="text-sm text-muted-foreground">
                  Joined {new Date(member.joined_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};