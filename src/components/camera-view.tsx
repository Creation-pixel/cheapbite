'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from './ui/alert';

interface CameraViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (imageDataUri: string) => void;
}

export function CameraView({ open, onOpenChange, onCapture }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      if (!open) {
        // Stop camera tracks when dialog is closed
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setHasCameraPermission(null); // Reset permission state
        return;
      }
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings.',
        });
      }
    };

    getCameraPermission();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [open, toast]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const dataUri = canvas.toDataURL('image/jpeg');
      onCapture(dataUri);
    }
    setIsCapturing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Scan Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {hasCameraPermission === null && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="ml-2">Requesting camera access...</p>
            </div>
          )}
          
          {hasCameraPermission === false && (
             <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Please allow camera access in your browser settings to use this feature.
              </AlertDescription>
            </Alert>
          )}

          <div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden">
             {hasCameraPermission && <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />}
             <canvas ref={canvasRef} className="hidden" />
          </div>

        </div>
        <DialogFooter>
            <Button onClick={handleCapture} disabled={isCapturing || !hasCameraPermission} className="w-full">
                {isCapturing ? <Loader2 className="mr-2 animate-spin" /> : <Camera className="mr-2" />}
                Scan Image
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    