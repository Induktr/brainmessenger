import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/types/chat";

interface ChatHeaderProps {
	chat: Chat;
	onBack: () => void;
	onOpenSettings: () => void;
}

export const ChatHeader = ({ chat, onBack, onOpenSettings }: ChatHeaderProps) => {
	return (
		<div className="flex items-center justify-between px-4 py-3 border-b bg-white">
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={onBack}
					className="md:hidden"
				>
					<ArrowLeft className="h-5 w-5" />
				</Button>
				<div>
					<h2 className="font-semibold">{chat.name}</h2>
					{chat.is_group && (
						<p className="text-sm text-gray-500">
							{chat.members.length} members
						</p>
					)}
				</div>
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={onOpenSettings}
			>
				Settings
			</Button>
		</div>
	);
};