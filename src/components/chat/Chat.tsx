import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMember {
  chat_id: string;
  user_id: string;
  joined_at: string;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  }
}

export const Chat = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<ChatMember[]>([]);

  const fetchChatMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          user_id,
          joined_at,
          user:profiles!chat_members_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `)
        .returns<ChatMember[]>();

      if (error) {
        console.error('Error fetching chat members:', error);
        toast.error('Failed to load chat members');
        return;
      }

      if (data) {
        setMembers(data);
      }
    } catch (err) {
      console.error('Error in fetchChatMembers:', err);
      toast.error('An unexpected error occurred');
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
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Chat Members</h1>
      <div className="space-y-4">
        {members.map((member) => (
          <div 
            key={`${member.chat_id}-${member.user_id}`}
            className="flex items-center space-x-4 p-4 bg-card rounded-lg shadow"
          >
            <div className="flex-shrink-0">
              {member.user?.avatar_url && (
                <img 
                  src={member.user.avatar_url} 
                  alt={member.user.display_name}
                  className="h-10 w-10 rounded-full"
                />
              )}
            </div>
            <div>
              <p className="font-medium">{member.user?.display_name}</p>
              <p className="text-sm text-muted-foreground">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};