import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Paperclip, Send, X, File, Image as ImageIcon, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { spring, dur, ease } from '@/lib/motion';
import IntegrationsModal from './IntegrationsModal';
import { Button } from './ui/button';

interface AttachedFile {
  id: string;
  file: File;
  type: 'image' | 'document';
  preview?: string;
}

interface ChatComposerProps {
  onSubmit: (query: string, files?: File[]) => void;
  isLoading: boolean;
  placeholder?: string;
  chatCredits?: { total: number; isUnlimited: boolean };
  documentCredits?: { total: number; isUnlimited: boolean };
  userEmail?: string;
  userId?: string;
  initialPrompt?: string;
  onPromptInjected?: () => void;
  hasStartedChat?: boolean;
}

// Custom hook for typing effect
const useTypingEffect = (texts: string[], typingSpeed = 100, deletingSpeed = 50, pauseDuration = 2000) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const currentText = texts[currentIndex];

    if (isPaused) {
      const pauseTimeout = setTimeout(() => {
        setIsPaused(false);
        setIsDeleting(true);
      }, pauseDuration);
      return () => clearTimeout(pauseTimeout);
    }

    if (!isDeleting && displayedText === currentText) {
      setIsPaused(true);
      return;
    }

    if (isDeleting && displayedText === '') {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % texts.length);
      return;
    }

    const timeout = setTimeout(
      () => {
        if (isDeleting) {
          setDisplayedText(currentText.substring(0, displayedText.length - 1));
        } else {
          setDisplayedText(currentText.substring(0, displayedText.length + 1));
        }
      },
      isDeleting ? deletingSpeed : typingSpeed
    );

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, isPaused, currentIndex, texts, typingSpeed, deletingSpeed, pauseDuration]);

  return displayedText;
};

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSubmit,
  isLoading,
  placeholder = 'Describe your sourcing requirements or upload supplier documents…',
  chatCredits = { total: 0, isUnlimited: false },
  documentCredits = { total: 0, isUnlimited: false },
  userEmail,
  userId,
  initialPrompt,
  onPromptInjected,
  hasStartedChat = false
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [content, setContent] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [checkingGmail, setCheckingGmail] = useState(true);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Typing effect for placeholder - stop when chat has started
  const placeholderTexts = [
    'Describe your sourcing requirements or upload supplier documents…',
    'Find the best suppliers for your needs…',
    'Generate professional RFPs instantly…',
    'Match with verified suppliers worldwide…',
  ];
  const typedPlaceholder = useTypingEffect(placeholderTexts, 80, 40, 2000);
  const displayPlaceholder = hasStartedChat ? placeholderTexts[0] : typedPlaceholder;

  // Check Gmail connection status
  useEffect(() => {
    const checkGmailStatus = async () => {
      if (!userId) {
        setCheckingGmail(false);
        return;
      }
      
      try {
        const response = await fetch('/api/integrations/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (response.ok) {
          const data = await response.json();
          setGmailConnected(data.gmail?.connected || false);
        }
      } catch (error) {
        console.error('Error checking Gmail status:', error);
      } finally {
        setCheckingGmail(false);
      }
    };

    checkGmailStatus();
  }, [userId]);

  // Set initial content with single line break
  useEffect(() => {
    if (contentEditableRef.current && !content) {
      contentEditableRef.current.innerHTML = '<br>';
      // Place cursor at the beginning
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(contentEditableRef.current, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  // Handle initial prompt injection
  useEffect(() => {
    if (initialPrompt && contentEditableRef.current) {
      setContent(initialPrompt);
      contentEditableRef.current.textContent = initialPrompt;
      // Place cursor at the end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      // Focus the input
      contentEditableRef.current.focus();
      // Notify parent that prompt was injected
      if (onPromptInjected) {
        onPromptInjected();
      }
    }
  }, [initialPrompt, onPromptInjected]);

  // Auto-resize logic
  useEffect(() => {
    if (contentEditableRef.current) {
      contentEditableRef.current.style.height = 'auto';
      const scrollHeight = contentEditableRef.current.scrollHeight;
      contentEditableRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [content]);

  // Handle content change - preserve innerHTML to maintain formatting
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || '';
    setContent(text);
  };

  // Handle paste (plain text only)
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  // Add files with validation
  const addFiles = (files: File[]) => {
    const validFiles: AttachedFile[] = [];
    
    files.forEach(file => {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 10MB)`);
        return;
      }

      const isImage = file.type.startsWith('image/');
      const isDocument = file.type.includes('pdf') || 
                        file.type.includes('document') || 
                        file.type.includes('text') ||
                        file.name.endsWith('.txt') ||
                        file.name.endsWith('.doc') ||
                        file.name.endsWith('.docx');

      if (!isImage && !isDocument) {
        toast.error(`File type not supported: ${file.name}`);
        return;
      }

      const id = `${Date.now()}-${Math.random()}`;
      const attachedFile: AttachedFile = {
        id,
        file,
        type: isImage ? 'image' : 'document'
      };

      // Create preview for images
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachedFile.preview = e.target?.result as string;
          setAttachedFiles(prev => [...prev, attachedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        validFiles.push(attachedFile);
      }
    });

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === containerRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  // Handle submit
  const handleSubmit = () => {
    // Get content with preserved formatting (convert <br> to \n)
    let formattedContent = '';
    if (contentEditableRef.current) {
      const innerHTML = contentEditableRef.current.innerHTML;
      // Replace <br> and <div> tags with newlines
      formattedContent = innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<div>/gi, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]*>/g, '')
        .trim();
    }
    
    if (!formattedContent && attachedFiles.length === 0) {
      return;
    }

    if (isLoading) {
      return;
    }

    // Validate credits before submission
    // Check chat credits if there's a query
    if (formattedContent) {
      if (!DEMO_MODE && !chatCredits.isUnlimited && chatCredits.total < 1) {
        toast.error('Insufficient chat credits', {
          description: 'You need at least 1 chat credit to send a query. Please upgrade your plan.',
        });
        return;
      }
    }

    // Check document credits if there are files
    if (attachedFiles.length > 0) {
      if (!DEMO_MODE && !documentCredits.isUnlimited && documentCredits.total < attachedFiles.length) {
        toast.error('Insufficient document credits', {
          description: `You need ${attachedFiles.length} document credit(s) but only have ${documentCredits.total}. Please upgrade your plan.`,
        });
        return;
      }
    }

    const files = attachedFiles.map(af => af.file);
    onSubmit(formattedContent, files);

    // Reset content and dimensions
    setContent('');
    setAttachedFiles([]);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = '<br>';
      contentEditableRef.current.style.height = 'auto';
      contentEditableRef.current.style.minHeight = '48px';
      // Place cursor at the beginning
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(contentEditableRef.current, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = (content.trim() || attachedFiles.length > 0) && !isLoading;

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-visible"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.enter, ease: ease.standard }}
            className="pointer-events-none absolute inset-0 z-50 rounded-2xl border-2 border-dashed border-primary/60 bg-surface/90 backdrop-blur-sm"
          >
            <div className="flex h-full flex-col items-center justify-center">
              <Paperclip className="mb-2 h-12 w-12 text-primary" aria-hidden="true" />
              <p className="text-lg font-semibold text-foreground">Drop files here</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main composer container */}
      <div className="panel relative overflow-hidden rounded-2xl transition-[border-color] duration-200 focus-within:border-primary/50">
        {/* Attached files preview */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-border"
            >
              <div className="p-3 flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : spring.ui}
                    className="relative group"
                  >
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2">
                      {file.type === 'image' ? (
                        <>
                          {file.preview ? (
                            <img
                              src={file.preview}
                              alt={file.file.name}
                              width={32}
                              height={32}
                              className="h-8 w-8 rounded object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                          )}
                        </>
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span className="max-w-[100px] truncate text-xs font-medium text-foreground">
                        {file.file.name}
                      </span>
                      <button
                        onClick={() => removeFile(file.id)}
                        className="touch-manipulation rounded-lg p-1 transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove ${file.file.name}`}
                      >
                        <X className="h-3 w-3 text-destructive" aria-hidden="true" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input area */}
        <div className="flex flex-col gap-2 p-3">
          {/* ContentEditable area */}
          <div className="flex-1 relative">
            <div
              ref={contentEditableRef}
              contentEditable
              onInput={handleInput}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              role="textbox"
              aria-multiline="true"
              aria-label="Message"
              className="w-full overflow-y-auto rounded-[var(--radius-inner)] px-3 py-1.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                minHeight: '48px',
                maxHeight: '200px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflowWrap: 'break-word'
              }}
            />

            {/* Animated Placeholder */}
            {!content && (
              <motion.div
                className="pointer-events-none absolute left-3 top-1.5 text-base text-muted-foreground"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: dur.enter, ease: ease.standard }}
              >
                {displayPlaceholder}
              </motion.div>
            )}
          </div>

          {/* Bottom row with icons */}
          <div className="flex items-center justify-between">
            {/* Left actions */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsIntegrationsModalOpen(true)}
                className="relative rounded-xl text-muted-foreground hover:bg-secondary hover:text-primary"
                title={!checkingGmail && !gmailConnected ? 'Gmail not connected. Click to connect.' : 'Integrations'}
                aria-label={!checkingGmail && !gmailConnected ? 'Gmail not connected. Click to connect.' : 'Integrations'}
              >
                <Settings className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                {!checkingGmail && !gmailConnected && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-label text-destructive-foreground"
                    initial={shouldReduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={spring.ui}
                  >
                    !
                  </motion.span>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-xl text-muted-foreground hover:bg-secondary hover:text-primary"
                title="Attach files (images, PDFs, docs)"
                aria-label={
                  attachedFiles.length > 0
                    ? `Attach files, ${attachedFiles.length} attached`
                    : 'Attach files'
                }
              >
                <Paperclip className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                {attachedFiles.length > 0 && (
                  <motion.span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-label text-primary-foreground"
                    initial={shouldReduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={spring.ui}
                  >
                    {attachedFiles.length}
                  </motion.span>
                )}
              </Button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Right action: send, or a spinner while the agent is working */}
            <div className="flex items-center justify-center" style={{ width: '44px', height: '44px' }}>
              <Button
                type="button"
                size="icon"
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className="rounded-xl disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100"
                title={isLoading ? 'Sending…' : 'Send (Enter)'}
                aria-label={isLoading ? 'Sending…' : 'Send message'}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <motion.div
        className="mt-2 flex items-center justify-between px-2 text-xs text-muted-foreground"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.enter, ease: ease.standard, delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          {attachedFiles.length > 0 && (
            <motion.span
              initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : spring.ui}
              className="flex items-center gap-1"
              aria-live="polite"
            >
              <Paperclip className="w-3 h-3" aria-hidden="true" />
              {attachedFiles.length} file{attachedFiles.length > 1 ? 's' : ''} attached
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* Integrations Modal */}
      {userId && (
        <IntegrationsModal
          isOpen={isIntegrationsModalOpen}
          onClose={() => setIsIntegrationsModalOpen(false)}
          userId={userId}
        />
      )}
    </div>
  );
};

export default ChatComposer;