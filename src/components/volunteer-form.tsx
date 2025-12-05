
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Loader2, ExternalLink } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


export function VolunteerForm() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to volunteer.' });
      return;
    }
    if (!name || !email || !message) {
      toast({ variant: 'destructive', title: 'Incomplete Form', description: 'Please fill out all fields.' });
      return;
    }
    setIsSubmitting(true);
    
    const volunteerData = {
        userId: user.uid,
        name: name,
        email: email,
        message: message,
        createdAt: serverTimestamp(),
    };

    const volunteersCol = collection(firestore, 'volunteers');
    
    addDoc(volunteersCol, volunteerData)
        .then(() => {
            toast({ title: 'Application Sent!', description: "Thank you for your interest. We'll be in touch!" });
            setMessage('');
            setIsOpen(false);
        })
        .catch((serverError) => {
            console.error("Error submitting volunteer form:", serverError);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'volunteers',
                operation: 'create',
                requestResourceData: volunteerData
            }));
            toast({ variant: 'destructive', title: 'Submission Failed', description: 'Could not submit your application. Please try again.' });
        })
        .finally(() => {
            setIsSubmitting(false);
        });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          Join Our Team <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Become a Volunteer</DialogTitle>
          <DialogDescription>
            Interested in helping out? Let us know how you'd like to contribute.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Your Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">How would you like to help?</Label>
            <Textarea id="message" placeholder="I have experience in marketing, community management..." value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
    