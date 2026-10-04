import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Send, X, Pencil, TrendingDown, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { enterItem } from '@/lib/motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface ApprovalCardProps {
  negotiationId: string;
  vendor: string;
  vendorEmail: string;
  currentAmount: string;
  askingFor: string;
  potentialSaving: string;
  leverage: string;
  subject: string;
  body: string;
  customerEmail: string;
  userId?: string;
  onSent?: (vendor: string) => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  negotiationId, vendor, vendorEmail, currentAmount, askingFor, potentialSaving,
  leverage, subject, body, customerEmail, userId, onSent,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(subject);
  const [draftBody, setDraftBody] = useState(body);
  const [busy, setBusy] = useState<'send' | 'cancel' | null>(null);
  const [done, setDone] = useState<'sent' | 'cancelled' | null>(null);

  const act = async (action: 'send' | 'cancel') => {
    setBusy(action);
    try {
      const res = await fetch('/api/negotiate/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negotiationId, customerEmail, userId, action,
          subject: draftSubject, body: draftBody,
        }),
      });
      const data = await res.json();

      if (action === 'cancel') {
        setDone('cancelled');
        toast('Counter-offer discarded');
        return;
      }

      if (data.success) {
        setDone('sent');
        toast.success(`Counter-offer sent to ${vendor}`, { description: `Asking for ${askingFor}` });
        onSent?.(vendor);
      } else {
        toast.error('Could not send', { description: data.error });
      }
    } catch (err: any) {
      toast.error('Could not send', { description: err.message });
    } finally {
      setBusy(null);
    }
  };

  if (done === 'sent') {
    return (
      <div className="panel flex items-center gap-2.5 px-4 py-3" role="status">
        <Check className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
        <p className="text-sm text-foreground">
          Counter-offer sent to <span className="font-semibold">{vendor}</span>, asking for {askingFor}.
        </p>
      </div>
    );
  }

  if (done === 'cancelled') {
    return (
      <div className="panel flex items-center gap-2.5 px-4 py-3" role="status">
        <X className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Counter-offer discarded. Nothing was sent.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={shouldReduceMotion ? false : enterItem(0).initial}
      animate={enterItem(0).animate}
      transition={shouldReduceMotion ? { duration: 0 } : enterItem(0).transition}
      className="panel overflow-hidden"
    >
      <div className="border-b border-border bg-sunken/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <TrendingDown className="h-4 w-4 text-foreground" aria-hidden="true" />
          <span className="text-label text-muted-foreground">Counter-offer ready, not sent yet</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-sm font-semibold text-foreground">{vendor}</span>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {currentAmount} <span aria-hidden="true">&rarr;</span> {askingFor}
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            saves {potentialSaving}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 italic">{leverage}</p>
      </div>

      <div className="px-4 py-3 space-y-2">
        {editing ? (
          <>
            <Input
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              className="font-medium"
              aria-label="Email subject"
              type="text"
              autoComplete="off"
            />
            <Textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={10}
              className="resize-y leading-relaxed"
              aria-label="Email body"
              autoComplete="off"
            />
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">{draftSubject}</p>
            <p className="text-xs text-muted-foreground">To: {vendorEmail}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pt-1">
              {draftBody}
            </p>
          </>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => act('send')} disabled={busy !== null}>
          {busy === 'send' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {busy === 'send' ? 'Sending…' : 'Approve and send'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing(!editing)}
          disabled={busy !== null}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {editing ? 'Done editing' : 'Edit'}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => act('cancel')}
          disabled={busy !== null}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Discard
        </Button>
      </div>
    </motion.div>
  );
};

export default ApprovalCard;
