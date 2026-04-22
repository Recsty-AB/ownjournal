import { useState, useEffect, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Tag, Heart, Save, Edit3, Trash2, ImagePlus, X, Loader2, FileText, Activity, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/utils/dateLocale";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { AIAnalysis } from "./AIAnalysis";
import { TitleSuggestion } from "./TitleSuggestion";
import { TagSuggestion } from "./TagSuggestion";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { Document, Paragraph, TextRun, Packer } from "docx";
import { saveAs } from "file-saver";
import { journalEntrySchema, tagSchema } from "@/utils/validation";
import { MOOD_EMOJI } from "@/utils/moodEmoji";
import { MOOD_BADGE_COLORS as moodColors } from "@/utils/moodColors";
import { PREDEFINED_ACTIVITIES, getActivityEmoji } from "@/utils/activities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ToastAction } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-mobile";

export interface JournalEntryData {
  id: string;
  date: Date;
  title: string;
  body: string;
  tags: string[];
  mood: 'great' | 'good' | 'okay' | 'poor' | 'terrible';
  images?: string[]; // base64 encoded images
  activities?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface JournalEntryProps {
  entry?: JournalEntryData;
  onSave: (entry: Omit<JournalEntryData, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  onCancel?: () => void;
  isEditing?: boolean;
  onEditingChange?: (isEditing: boolean) => void;
  allEntries?: JournalEntryData[]; // For tag suggestions
  isPro?: boolean;
  isDemo?: boolean;
  editingEntryId?: string | null;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

const PREDEFINED_ACTIVITY_KEYS = PREDEFINED_ACTIVITIES.map(a => a.key);

const JournalEntryInner = ({ entry, onSave, onDelete, onCancel, isEditing = false, onEditingChange, allEntries = [], isPro = false, isDemo = false, editingEntryId, onEditStart, onEditEnd }: JournalEntryProps) => {
  const [isEditMode, setIsEditMode] = useState(isEditing);
  const [title, setTitle] = useState(entry?.title || "");
  const [body, setBody] = useState(entry?.body || "");
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [mood, setMood] = useState<JournalEntryData['mood']>(entry?.mood || 'okay');
  const [activities, setActivities] = useState<string[]>(entry?.activities || []);
  const [activityInput, setActivityInput] = useState("");
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const [images, setImages] = useState<string[]>(entry?.images || []);
  const [tagInput, setTagInput] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(entry?.date || new Date());
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();


  // Check if another entry is being edited
  const isAnotherEntryEditing = editingEntryId && editingEntryId !== entry?.id && editingEntryId !== 'new-entry';

  // Get unique tags from all entries for suggestions
  const allUniqueTags = Array.from(new Set(allEntries.flatMap(e => e.tags)))
    .filter(tag => !tags.includes(tag)); // Exclude already selected tags

  // Sync state when entry prop updates (e.g., snapshot -> full decrypted data)
  // Only sync when NOT in edit mode to avoid overwriting user edits
  useEffect(() => {
    if (!isEditMode && entry) {
      setTitle(entry.title || "");
      setBody(entry.body || "");
      setTags(entry.tags || []);
      setMood(entry.mood || 'okay');
      setActivities(entry.activities || []);
      setImages(entry.images || []);
      setSelectedDate(entry.date || new Date());
    }
  }, [entry?.id, entry?.body, entry?.updatedAt, isEditMode]);

  // Call onEditStart when entering edit mode initially
  useEffect(() => {
    if (isEditing && onEditStart) {
      onEditStart();
    }
  }, []);

  // Reset activity drawer state whenever we leave edit mode so it doesn't
  // auto-reopen next time the user enters edit mode.
  useEffect(() => {
    if (!isEditMode) setActivityDrawerOpen(false);
  }, [isEditMode]);

  // Close edit mode when global back is triggered
  useEffect(() => {
    const onBack = () => {
      if (isEditMode && entry) {
        setIsEditMode(false);
        onEditEnd?.();
        onEditingChange?.(false);
      }
    };
    window.addEventListener('app:back', onBack as EventListener);
    return () => window.removeEventListener('app:back', onBack as EventListener);
  }, [isEditMode, entry, onEditingChange, onEditEnd]);

 const handleSave = () => {
    // Validate entry data
    try {
      journalEntrySchema.parse({
        date: selectedDate,
        title,
        body,
        tags,
        mood,
        activities,
      });
    } catch (error) {
      const firstError = error && typeof error === 'object' && 'errors' in error ? (error.errors as Array<{message?: string}>)[0] : undefined;
      toast({
        title: t('journalEntry.validationError'),
        description: firstError?.message || t('journalEntry.validationErrorDesc'),
        variant: "destructive",
      });
      return;
    }

    onSave({
      ...(entry?.id && { id: entry.id }), // Pass existing ID if editing
      date: selectedDate,
      title,
      body,
      tags,
      mood,
      activities,
      images
    });
    setIsEditMode(false);
    onEditEnd?.();
    onEditingChange?.(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    onEditEnd?.();
    onEditingChange?.(false);
    onCancel?.();
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Calculate new dimensions (max 1920px)
          const MAX_SIZE = 1920;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.8 quality
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const calculateTotalImageSize = (imageList: string[]): number => {
    return imageList.reduce((total, img) => {
      // Rough estimate: base64 string length * 0.75 gives approximate byte size
      return total + (img.length * 0.75);
    }, 0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const files = e.target.files;
    if (!files) return;

    setIsCompressing(true);
    const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total limit
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: t('journalEntry.fileTooLarge'),
          description: t('journalEntry.fileTooLargeDesc'),
          variant: "destructive",
        });
        continue;
      }

      try {
        const compressed = await compressImage(file);
        newImages.push(compressed);
        
        // Check total size with new images
        const totalSize = calculateTotalImageSize([...images, ...newImages]);
        if (totalSize > MAX_TOTAL_SIZE) {
          toast({
            title: t('journalEntry.totalSizeLimit'),
            description: t('journalEntry.totalSizeLimitDesc'),
            variant: "destructive",
          });
          break;
        }

        toast({
          title: t('journalEntry.imageAdded'),
          description: t('journalEntry.imageAddedDesc'),
        });
      } catch (error) {
        toast({
          title: t('journalEntry.compressionFailed'),
          description: t('journalEntry.compressionFailedDesc'),
          variant: "destructive",
        });
      }
    }

    setImages((prev) => [...prev, ...newImages]);
    setIsCompressing(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);
    
    setImages(newImages);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const addTag = (tag: string) => {
    // Validate tag
    const result = tagSchema.safeParse(tag.trim());
    if (!result.success) {
      toast({
        title: t('journalEntry.invalidTag'),
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (tags.length >= 20) {
      toast({
        title: t('journalEntry.maxTags'),
        description: t('journalEntry.maxTagsDesc'),
        variant: "destructive",
      });
      return;
    }

    if (!tags.includes(result.data)) {
      setTags([...tags, result.data]);
      setTagInput("");
      setShowTagSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle arrow key navigation in suggestions
    if (showTagSuggestions && filteredTagSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredTagSuggestions.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag(filteredTagSuggestions[selectedSuggestionIndex]);
        return;
      }
      if (e.key === 'Tab' && filteredTagSuggestions.length > 0) {
        e.preventDefault();
        addTag(filteredTagSuggestions[selectedSuggestionIndex]);
        return;
      }
    }
    
    // Handle Enter when no suggestions or suggestions hidden
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  // Filter tag suggestions based on input
  const filteredTagSuggestions = allUniqueTags.filter(tag =>
    tag.toLowerCase().includes(tagInput.toLowerCase())
  ).slice(0, 8); // Show max 8 suggestions

  const exportToPDF = () => {
    if (!isPro) {
      toast({
        title: t('journalEntry.proFeature'),
        description: t('journalEntry.pdfExportPro'),
        variant: "destructive",
      });
      return;
    }

    if (!entry) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPosition = 20;

    // Title
    doc.setFontSize(20);
    doc.text(entry.title, margin, yPosition);
    yPosition += 15;

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(format(entry.date, 'PPPP', { locale: getDateLocale(i18n.language) }), margin, yPosition);
    yPosition += 10;

    // Mood
    doc.text(`${t('journalEntry.mood')}: ${MOOD_EMOJI[entry.mood] || ''} ${t(`journalEntry.moods.${entry.mood}`)}`, margin, yPosition);
    yPosition += 10;

    // Activities
    if (entry.activities && entry.activities.length > 0) {
      const activitiesText = entry.activities.map(a => {
        const emoji = getActivityEmoji(a);
        const label = PREDEFINED_ACTIVITIES.some(p => p.key === a) ? t(`activities.${a}`) : a;
        return emoji ? `${emoji} ${label}` : label;
      }).join(', ');
      doc.text(`${t('activities.label')}: ${activitiesText}`, margin, yPosition);
      yPosition += 10;
    }

    // Tags
    if (entry.tags.length > 0) {
      doc.text(`${t('journalEntry.tags')}: ${entry.tags.join(', ')}`, margin, yPosition);
      yPosition += 15;
    } else {
      yPosition += 5;
    }

    // Body
    doc.setFontSize(12);
    doc.setTextColor(0);
    const bodyLines = doc.splitTextToSize(entry.body, pageWidth - 2 * margin);
    doc.text(bodyLines, margin, yPosition);

    doc.save(`${entry.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    toast({
      title: t('journalEntry.pdfExported'),
      description: t('journalEntry.pdfExportedDesc'),
    });
  };

  const exportToWord = async () => {
    if (!isPro) {
      toast({
        title: t('journalEntry.proFeature'),
        description: t('journalEntry.wordExportPro'),
        variant: "destructive",
      });
      return;
    }

    if (!entry) return;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: entry.title,
                bold: true,
                size: 32,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: format(entry.date, 'PPPP', { locale: getDateLocale(i18n.language) }),
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${t('journalEntry.mood')}: ${MOOD_EMOJI[entry.mood] || ''} ${t(`journalEntry.moods.${entry.mood}`)}`,
                size: 20,
              }),
            ],
            spacing: { after: 100 },
          }),
          ...(entry.activities && entry.activities.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${t('activities.label')}: ${entry.activities.map(a => {
                    const emoji = getActivityEmoji(a);
                    const label = PREDEFINED_ACTIVITIES.some(p => p.key === a) ? t(`activities.${a}`) : a;
                    return emoji ? `${emoji} ${label}` : label;
                  }).join(', ')}`,
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            }),
          ] : []),
          ...(entry.tags.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${t('journalEntry.tags')}: ${entry.tags.join(', ')}`,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
          ] : []),
          new Paragraph({
            children: [
              new TextRun({
                text: entry.body,
                size: 24,
              }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${entry.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`);
    toast({
      title: t('journalEntry.wordExported'),
      description: t('journalEntry.wordExportedDesc'),
    });
  };

  if (!isEditMode && entry) {
    return (
      <Card className="p-4 sm:p-6 shadow-medium hover:shadow-large transition-all duration-300 bg-gradient-paper">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          {/* Date - full width on mobile */}
          <div className="flex items-center gap-3 min-w-0">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground truncate">
              {format(entry.date, 'PPPP', { locale: getDateLocale(i18n.language) })}
            </span>
          </div>
          
          {/* Action buttons - row with icon-only */}
          <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            {isPro && (
              <>
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9" onClick={exportToPDF} title={t('journal.exportPDFTitle')}>
                  <FileText className="w-5 h-5 text-red-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9" onClick={exportToWord} title={t('journal.exportWordTitle')}>
                  <FileText className="w-5 h-5 text-blue-600" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 sm:h-9 sm:w-9 ${isAnotherEntryEditing ? 'opacity-50' : ''}`}
              aria-disabled={isAnotherEntryEditing || undefined}
              onClick={() => {
                if (isAnotherEntryEditing) {
                  toast({
                    title: t('journal.anotherEntryEditing'),
                    description: t('journal.anotherEntryEditingDesc'),
                    variant: "destructive",
                    action: (
                      <ToastAction
                        altText={t('journal.goToEditingEntry')}
                        onClick={() => {
                          if (editingEntryId && editingEntryId !== 'new-entry') {
                            const target = document.querySelector(`[data-entry-id="${editingEntryId}"]`);
                            if (target) {
                              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }
                        }}
                      >
                        {t('journal.goToEditingEntry')}
                      </ToastAction>
                    ),
                  });
                  return;
                }
                setIsEditMode(true);
                onEditStart?.();
                onEditingChange?.(true);
              }}
              title={isAnotherEntryEditing ? t('journal.finishEditingFirst') : t('journal.editEntry')}
            >
              <Edit3 className="w-5 h-5" />
            </Button>
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-9 sm:w-9">
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('journal.deleteEntryConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('journal.deleteEntryConfirmDesc', { title: entry.title })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => onDelete(entry.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {t('common.delete')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4 text-foreground">{entry.title}</h2>
        
        <div className="prose prose-lg max-w-none mb-6 text-foreground">
          <div className="whitespace-pre-wrap leading-relaxed">{entry.body}</div>
        </div>

        {entry.images && entry.images.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            {entry.images.map((img, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`cursor-move transition-all ${
                  draggedIndex === idx ? 'opacity-50 scale-95' : ''
                } ${dragOverIndex === idx && draggedIndex !== idx ? 'scale-105 ring-2 ring-primary' : ''}`}
              >
                <img src={img} alt={`Entry image ${idx + 1}`} className="h-40 w-40 object-cover rounded-lg shadow-sm" />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-muted-foreground" />
            <Badge variant="secondary" className={moodColors[entry.mood]}>
              {MOOD_EMOJI[entry.mood]} {t(`journalEntry.moods.${entry.mood}`)}
            </Badge>
          </div>
          
          {entry.activities && entry.activities.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Activity className="w-4 h-4 text-muted-foreground" />
              {entry.activities.map(activity => (
                <Badge key={activity} variant="outline" className="text-xs">
                  {getActivityEmoji(activity)}{getActivityEmoji(activity) ? ' ' : ''}{PREDEFINED_ACTIVITIES.some(p => p.key === activity) ? t(`activities.${activity}`) : activity}
                </Badge>
              ))}
            </div>
          )}

          {entry.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-muted-foreground" />
              {entry.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <AIAnalysis 
          entryId={entry.id}
          content={entry.body}
          createdAt={entry.createdAt}
          tags={entry.tags}
          mood={entry.mood}
          isPro={isPro}
          isDemo={isDemo}
          onApplyTags={(suggestedTags) => {
            const currentTags = entry.tags || [];
            const newTags = [...new Set([...currentTags, ...suggestedTags])];
            // This is view mode, so we can't directly update, but we can trigger edit mode
            toast({
              title: t('journal.switchToEditMode'),
              description: t('journal.switchToEditModeDesc'),
            });
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 shadow-medium bg-gradient-paper overflow-hidden max-w-full">
      <div className="space-y-6 min-w-0">
        <div className="flex items-center gap-3 text-sm xl:text-base text-muted-foreground mb-4">
          <Calendar className="w-4 h-4 xl:w-5 xl:h-5 flex-shrink-0" />
          <Input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-auto border-0 bg-transparent p-0 focus-visible:ring-0 text-muted-foreground xl:text-base"
          />
        </div>

        <Input
          placeholder={t('journalEntry.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl xl:text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground"
        />

        {body.length >= 20 && (
          <TitleSuggestion 
            content={body}
            tags={tags}
            mood={mood}
            onApply={setTitle}
            isPro={isPro}
          />
        )}

        <MarkdownEditor
          value={body}
          onChange={setBody}
          placeholder={t('journalEntry.startWriting')}
        />

        <div className="space-y-3">
          {/* Mood selector with horizontal scroll on mobile */}
          <div className="flex items-center gap-3 min-w-0">
            <Heart className="w-4 h-4 xl:w-5 xl:h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
              {(['great', 'good', 'okay', 'poor', 'terrible'] as const).map((moodOption) => (
                <Button
                  key={moodOption}
                  variant={mood === moodOption ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMood(moodOption)}
                  className="capitalize text-xs sm:text-sm xl:text-base px-2 sm:px-3 xl:px-4 min-h-10 xl:min-h-11 gap-1.5"
                  aria-label={t(`journalEntry.moods.${moodOption}`)}
                >
                  {/* Emoji on desktop; mobile stays text-only to keep the row compact. */}
                  <span aria-hidden="true" className="hidden sm:inline">{MOOD_EMOJI[moodOption]}</span>
                  <span>{t(`journalEntry.moods.${moodOption}`)}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Activity selector — drawer on mobile, inline on desktop */}
          {(() => {
            const toggleActivity = (key: string) => {
              setActivities(prev =>
                prev.includes(key)
                  ? prev.filter(a => a !== key)
                  : [...prev, key]
              );
            };
            const addCustomActivity = () => {
              const newActivity = activityInput.trim().toLowerCase();
              if (newActivity) {
                if (activities.includes(newActivity)) {
                  // already exists, just clear input below
                } else if (activities.length >= 20) {
                  toast({
                    title: t('journalEntry.maxActivitiesReached', { defaultValue: 'Activity limit reached' }),
                    description: t('journalEntry.maxActivitiesReachedDesc', { defaultValue: 'You can have at most 20 activities per entry.' }),
                    variant: "destructive",
                  });
                  return;
                } else {
                  setActivities(prev => [...prev, newActivity]);
                }
              }
              setActivityInput("");
            };
            const customActivities = activities.filter(a => !PREDEFINED_ACTIVITIES.some(p => p.key === a));

            // Shared content rendered both inline (desktop) and in drawer (mobile)
            const ActivityList = ({ vertical = false }: { vertical?: boolean }) => (
              <>
                <div className={vertical ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
                  {PREDEFINED_ACTIVITIES.map((activity) => (
                    <Button
                      key={activity.key}
                      variant={activities.includes(activity.key) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleActivity(activity.key)}
                      className={vertical ? "justify-start whitespace-nowrap xl:min-h-11 xl:text-base xl:px-4" : "whitespace-nowrap flex-shrink-0 xl:min-h-11 xl:text-base xl:px-4"}
                      aria-label={t(`activities.${activity.key}`)}
                    >
                      <span aria-hidden="true">{activity.emoji}</span>
                      <span className="ml-1">{t(`activities.${activity.key}`)}</span>
                    </Button>
                  ))}
                </div>
                <Input
                  placeholder={t('activities.addCustom')}
                  value={activityInput}
                  onChange={(e) => setActivityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && activityInput.trim()) {
                      e.preventDefault();
                      addCustomActivity();
                    }
                  }}
                  className={vertical ? "xl:text-base" : "border-0 bg-transparent p-0 focus-visible:ring-0 xl:text-base"}
                />
                {customActivities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {customActivities.map(activity => (
                      <Badge
                        key={activity}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors xl:text-base"
                        onClick={() => setActivities(prev => prev.filter(a => a !== activity))}
                      >
                        {activity} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            );

            if (isMobile) {
              // Mobile: compact summary button that opens a bottom drawer
              const selectedSummary = activities.length === 0
                ? t('activities.label')
                : `${t('activities.label')} (${activities.length})`;

              return (
                <div>
                  <Drawer open={activityDrawerOpen} onOpenChange={setActivityDrawerOpen}>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setActivityDrawerOpen(true)}
                      className="w-full justify-between"
                      size="sm"
                    >
                      <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        {selectedSummary}
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <DrawerContent>
                      <DrawerHeader className="text-left">
                        <DrawerTitle className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          {t('activities.label')}
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="px-4 pb-4 space-y-4 overflow-y-auto">
                        <ActivityList vertical />
                      </div>
                      <DrawerFooter>
                        <DrawerClose asChild>
                          <Button>{t('common.done')}</Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </DrawerContent>
                  </Drawer>
                </div>
              );
            }

            // Desktop: inline pill row
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 xl:w-5 xl:h-5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm xl:text-base text-muted-foreground">{t('activities.label')}</span>
                </div>
                <div className="sm:ml-7 space-y-2">
                  <ActivityList />
                </div>
              </div>
            );
          })()}

          <div className="flex items-center gap-3">
            <Tag className="w-4 h-4 xl:w-5 xl:h-5 text-muted-foreground" />
            <div className="flex-1 relative">
              <Input
                placeholder={t('journalEntry.addTagsPlaceholder')}
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setShowTagSuggestions(e.target.value.length > 0);
                  setSelectedSuggestionIndex(0); // Reset selection on input change
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowTagSuggestions(tagInput.length > 0)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                className="border-0 bg-transparent p-0 focus-visible:ring-0 xl:text-base"
              />
              
              {/* Tag suggestions dropdown */}
              {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                  {filteredTagSuggestions.map((tag, index) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => addTag(tag)}
                      className={`w-full px-3 py-2 text-left text-sm xl:text-base transition-colors ${
                        index === selectedSuggestionIndex 
                          ? 'bg-accent text-accent-foreground' 
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:ml-7">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors xl:text-base"
                  onClick={() => removeTag(tag)}
                >
                  {tag} ×
                </Badge>
              ))}
            </div>
          )}

          {body.length >= 20 && (
            <div className="sm:ml-7">
              <TagSuggestion
                content={body}
                existingTags={tags}
                onApplyTags={(newTags) => setTags([...tags, ...newTags])}
                isPro={isPro}
                predefinedActivities={PREDEFINED_ACTIVITY_KEYS}
                existingActivities={activities}
                onApplyActivities={(newActivities) => {
                  setActivities(prev => {
                    const merged = [...prev];
                    let droppedDueToCap = false;
                    for (const a of newActivities) {
                      if (merged.includes(a)) continue; // already present, silent skip
                      if (merged.length >= 20) {
                        droppedDueToCap = true;
                        break;
                      }
                      merged.push(a);
                    }
                    if (droppedDueToCap) {
                      toast({
                        title: t('journalEntry.maxActivitiesReached', { defaultValue: 'Activity limit reached' }),
                        description: t('journalEntry.maxActivitiesReachedDesc', { defaultValue: 'Some activities were not added because you have reached the limit of 20.' }),
                      });
                    }
                    return merged;
                  });
                }}
                getActivityLabel={(key) => {
                  const predef = PREDEFINED_ACTIVITIES.find(a => a.key === key);
                  return predef ? `${predef.emoji} ${t(`activities.${key}`)}` : key;
                }}
              />
            </div>
          )}

          <div className="flex items-start gap-3">
            <ImagePlus className="w-4 h-4 xl:w-5 xl:h-5 text-muted-foreground mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm xl:text-base text-muted-foreground">{t('journal.images')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`relative group cursor-move transition-all ${
                      draggedIndex === idx ? 'opacity-50 scale-95' : ''
                    } ${dragOverIndex === idx && draggedIndex !== idx ? 'scale-105 ring-2 ring-primary' : ''}`}
                  >
                    <img src={img} alt={`Upload ${idx + 1}`} className="h-24 w-24 object-cover rounded-lg" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {isCompressing && (
                  <div className="h-24 w-24 rounded-lg flex items-center justify-center bg-muted">
                    <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                  </div>
                )}
                {!isCompressing && (
                  <label className="h-24 w-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:bg-accent transition-colors">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button onClick={handleSave} className="bg-gradient-primary xl:h-11 xl:px-4 xl:text-base">
            <Save className="w-4 h-4 xl:w-5 xl:h-5 mr-2" />
            {t('journalEntry.saveEntry')}
          </Button>
          {(entry || onCancel) && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="xl:h-11 xl:px-4 xl:text-base"
            >
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// Parent (Timeline) passes inline callbacks; comparing function identities would defeat
// memoization. Compare only props that should actually trigger a re-render.
export const JournalEntry = memo(JournalEntryInner, (prev, next) => {
  if (prev.entry !== next.entry) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (prev.editingEntryId !== next.editingEntryId) return false;
  if (prev.isPro !== next.isPro) return false;
  if (prev.isDemo !== next.isDemo) return false;
  if (prev.allEntries !== next.allEntries) return false;
  return true;
});