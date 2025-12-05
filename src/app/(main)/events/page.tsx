
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Event } from '@/lib/types';
import { Calendar, Clock, MapPin, Plus, UserCheck, UserX } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';


function EventSkeleton() {
    return (
        <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-full mt-2" />
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-5 w-2/3" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-24" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}

export default function EventsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'events'),
      where('participantIds', 'array-contains', user.uid)
    );
  }, [firestore, user]);

  const { data: events, isLoading } = useCollection<Event>(eventsQuery);

  const handleRsvp = (eventId: string, attending: boolean) => {
    if (!user || !firestore) return;
    const eventRef = doc(firestore, 'events', eventId);

    const currentEvent = events?.find(e => e.id === eventId);
    if (!currentEvent) return;

    let newAttendees = [...currentEvent.attendees];

    if (attending) {
      if (!newAttendees.includes(user.uid)) {
        newAttendees.push(user.uid);
      }
    } else {
      newAttendees = newAttendees.filter(uid => uid !== user.uid);
    }
    
    const updatedData = { attendees: newAttendees };
    updateDoc(eventRef, updatedData)
      .then(() => {
        toast({
            title: 'RSVP Updated!',
            description: `You are now ${attending ? 'attending' : 'not attending'} the event.`,
        });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: eventRef.path,
          operation: 'update',
          requestResourceData: updatedData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };
  
  const sortedEvents = useMemo(() => {
      if (!events) return [];
      return [...events].sort((a, b) => {
        const timeA = a.startTime ? a.startTime.seconds * 1000 : 0;
        const timeB = b.startTime ? b.startTime.seconds * 1000 : 0;
        return timeA - timeB;
      });
  }, [events]);


  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventDate, setNewEventDate] = useState<Date | undefined>(new Date());
  const [newEventTime, setNewEventTime] = useState<string>('17:00');
  
  const handleCreateEvent = () => {
    if (!user || !firestore || !newEventTitle || !newEventDate) return;

    const [hours, minutes] = newEventTime.split(':').map(Number);
    const finalEventDate = new Date(newEventDate);
    finalEventDate.setHours(hours, minutes);

    const eventsCol = collection(firestore, 'events');

    const newEventData = {
        title: newEventTitle,
        description: newEventDesc,
        createdBy: user.uid,
        startTime: finalEventDate,
        endTime: new Date(finalEventDate.getTime() + 60 * 60 * 1000), // 1 hour from now
        location: "TBD",
        participantIds: [user.uid],
        attendees: [user.uid],
        status: 'scheduled',
    };

    addDoc(eventsCol, newEventData)
        .then(() => {
            toast({
                title: "Event Created!",
                description: `Your event "${newEventTitle}" has been added.`
            });
            setNewEventTitle('');
            setNewEventDesc('');
            setNewEventDate(new Date());
            setNewEventTime('17:00');
            setIsCreateDialogOpen(false);
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: eventsCol.path,
              operation: 'create',
              requestResourceData: newEventData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  }

  const getEventStatus = (event: Event) => {
      if (!user) return null;
      const isAttending = event.attendees.includes(user.uid);
      const isCreator = event.createdBy === user.uid;

      if (isAttending) {
          return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Attending</Badge>;
      }
      if (isCreator) {
          return <Badge variant="secondary">Creator</Badge>;
      }
      if (event.participantIds.includes(user.uid) && !isAttending) {
          return <Badge variant="outline">Invited</Badge>
      }
      return null;
  }


  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold text-center bg-primary text-primary-foreground p-4 rounded-lg">Events</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>Fill in the details for your new event.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Input placeholder="Event Title" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} />
                <Textarea placeholder="Event Description" value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !newEventDate && "text-muted-foreground"
                            )}
                            >
                            <Calendar className="mr-2 h-4 w-4" />
                            {newEventDate ? format(newEventDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                            mode="single"
                            selected={newEventDate}
                            onSelect={setNewEventDate}
                            initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <Input
                        type="time"
                        value={newEventTime}
                        onChange={(e) => setNewEventTime(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={() => setIsCreateDialogOpen(false)} variant="ghost">Cancel</Button>
                <Button onClick={handleCreateEvent} disabled={!newEventTitle}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <EventSkeleton />}
      
      {!isLoading && sortedEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-background/50 p-12 text-center">
              <h3 className="text-xl font-semibold">No Events Yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You haven't created or been invited to any events.
              </p>
          </div>
      )}

      {!isLoading && sortedEvents.length > 0 && (
        <div className="space-y-6">
          {sortedEvents.map((event) => {
              const isCreator = event.createdBy === user?.uid;
              const isAttending = user ? event.attendees.includes(user.uid) : false;
              const isInvited = user ? event.participantIds.includes(user.uid) : false;
              const canRsvp = isInvited && !isCreator;

            return (
              <Card key={event.id}>
                  <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{event.title}</CardTitle>
                            <CardDescription>{event.description}</CardDescription>
                        </div>
                        {getEventStatus(event)}
                      </div>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{event.startTime ? new Date(event.startTime.seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Date TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{event.startTime ? new Date(event.startTime.seconds * 1000).toLocaleTimeString(undefined, { timeStyle: 'short' }) : 'Time TBD'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{event.location}</span>
                      </div>
                  </CardContent>
                  {canRsvp && (
                    <CardFooter className="gap-2">
                        {!isAttending ? (
                            <Button onClick={() => handleRsvp(event.id, true)}>
                                <UserCheck className="mr-2 h-4 w-4" /> Accept
                            </Button>
                        ) : (
                            <Button variant="outline" onClick={() => handleRsvp(event.id, false)}>
                                <UserX className="mr-2 h-4 w-4" /> Decline
                            </Button>
                        )}
                    </CardFooter>
                  )}
              </Card>
            )
        })}
        </div>
      )}
    </div>
  );
}
