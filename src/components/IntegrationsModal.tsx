import React, { useState, useEffect } from 'react';
import { Mail, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function IntegrationsModal({ isOpen, onClose, userId }: IntegrationsModalProps) {
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkGmailStatus();
    }
  }, [isOpen]);

  const checkGmailStatus = async () => {
    setCheckingStatus(true);
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
      setCheckingStatus(false);
    }
  };

  const handleGmailConnect = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'connect' }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Gmail connection');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect Gmail');
      setLoading(false);
    }
  };

  const handleGmailDisconnect = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'disconnect' }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Gmail');
      }

      setGmailConnected(false);
      toast.success('Gmail disconnected');
    } catch (error: any) {
      toast.error(error.message || 'Failed to disconnect Gmail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Integrations</DialogTitle>
          <DialogDescription>
            Connect Gmail so the agent can send RFPs and read vendor replies.
          </DialogDescription>
        </DialogHeader>

        {checkingStatus ? (
          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-inner)] border border-border bg-surface p-4 motion-safe:animate-pulse" aria-busy="true" aria-live="polite">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 rounded-[var(--radius-inner)] bg-sunken" />
              <div className="h-4 w-24 rounded bg-sunken" />
            </div>
            <div className="h-8 w-20 rounded-[var(--radius-inner)] bg-sunken" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-[var(--radius-inner)] border border-border bg-surface p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-[var(--radius-inner)] border border-border bg-sunken p-2.5">
                <Mail className="h-5 w-5 text-foreground" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground">Gmail</h3>
                {gmailConnected && (
                  <span className="flex items-center gap-1 rounded-full border border-border bg-sunken px-2 py-0.5 text-xs font-medium text-foreground">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Connected
                  </span>
                )}
              </div>
            </div>

            {gmailConnected ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGmailDisconnect}
                disabled={loading}
                className="shrink-0"
              >
                {loading ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleGmailConnect}
                disabled={loading}
                className="shrink-0"
              >
                {loading ? 'Connecting…' : 'Connect'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
