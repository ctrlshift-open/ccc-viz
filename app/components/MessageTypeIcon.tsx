export function getMessageTypeEmoji(key: string): string {
  // Parse the key to determine the emoji
  const parts = key.split('|');
  const mainType = parts[0];
  const subType = parts[1];
  const toolName = parts[2];
  
  // Handle tool use cases first
  if (subType === 'tool_use') {
    if (toolName === 'TodoWrite') return '📝';
    return '🔧';
  }
  
  // Handle other sub-types
  if (subType === 'tool_result') return '✅';
  if (subType === 'thinking') return '🧠';
  if (subType === 'message') {
    if (mainType === 'assistant') return '🤖';
    if (mainType === 'user') return '👤';
    return '💬';
  }
  if (subType === 'entry') {
    if (mainType === 'system') return '⚙️';
    return '📥';
  }
  
  // Handle main types without subtypes
  if (mainType === 'summary') return '📄';
  if (mainType === 'invalid') return '⚠️';
  if (mainType === 'system') return '⚙️';
  if (mainType === 'command') return '⌨️';
  if (mainType === 'environment_details') return '📊';
  if (mainType === 'text') return '💬';
  
  // Default emoji
  return '📦';
}

export function MessageTypeIcon({ 
  messageKey, 
  className = "" 
}: { 
  messageKey: string; 
  className?: string; 
}) {
  const emoji = getMessageTypeEmoji(messageKey);
  return <span className={className}>{emoji}</span>;
}

// For compatibility with the previous API
export function getMessageTypeIcon(key: string) {
  // Return a component that renders the emoji
  return function EmojiIcon({ className = "" }: { className?: string }) {
    return <span className={className}>{getMessageTypeEmoji(key)}</span>;
  };
}

export function getMessageTypeLabel(key: string, includeIcon: boolean = false): string {
  const parts = key.split('|');
  const mainType = parts[0];
  const subType = parts[1];
  const toolName = parts[2];
  
  // For tool use with specific tool names
  if (subType === 'tool_use' && toolName) {
    return toolName;
  }
  
  // For other tool uses
  if (subType === 'tool_use') {
    return includeIcon ? 'Tool' : `${mainType} - tool use`;
  }
  
  // For tool results
  if (subType === 'tool_result') {
    return includeIcon ? 'Result' : `${mainType} - tool result`;
  }
  
  // For thinking
  if (subType === 'thinking') {
    return includeIcon ? 'Thinking' : `${mainType} - thinking`;
  }
  
  // For messages
  if (subType === 'message') {
    if (includeIcon) {
      return mainType === 'assistant' ? 'Assistant' : 
             mainType === 'user' ? 'User' : 
             'Message';
    }
    return `${mainType} - message`;
  }
  
  // For entries
  if (subType === 'entry') {
    if (includeIcon) {
      return mainType === 'system' ? 'System' : 'Entry';
    }
    return `${mainType} - entry`;
  }
  
  // Simple types
  if (mainType === 'summary') return includeIcon ? 'Summary' : 'summary';
  if (mainType === 'invalid') return includeIcon ? 'Invalid' : 'invalid';
  
  // Default
  return mainType;
}