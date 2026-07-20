import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Edit3, Save, StickyNote, Tag, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/utils/dateLocale";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { noteSchema, tagSchema } from "@/utils/validation";
import { extractInlineTags, mergeInlineTags } from "@/utils/inlineTags";
import type { JournalEntryData } from "@/components/journal/JournalEntry";
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

export interface NoteSaveData {
  id?: string;
  title: string;
  body: string;
  tags: string[];
}

interface NoteCardProps {
  note?: JournalEntryData;
  /** All known tags (journal + notes) for suggestions and inline autocomplete. */
  allTags?: string[];
  onSave: (note: NoteSaveData) => void;
  onDelete?: (id: string) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

export const NoteCard = ({ note, allTags = [], onSave, onDelete, onCancel, isEditing = false }: NoteCardProps) => {
  const [isEditMode, setIsEditMode] = useState(isEditing);
  const [title, setTitle] = useState(note?.title || "");
  const [body, setBody] = useState(note?.body || "");
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  // Sync state when the note prop updates (e.g. after cloud sync), but never
  // while the user is editing.
  useEffect(() => {
    if (!isEditMode && note) {
      setTitle(note.title || "");
      setBody(note.body || "");
      setTags(note.tags || []);
    }
  }, [note?.id, note?.body, note?.updatedAt, isEditMode]);

  const autocompleteTags = Array.from(new Set([...allTags, ...tags]));

  const inlineTags = extractInlineTags(body).filter(
    tag => !tags.some(existing => existing.toLowerCase() === tag.toLowerCase())
  );

  const filteredTagSuggestions = autocompleteTags
    .filter(tag => !tags.includes(tag))
    .filter(tag => tag.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 8);

  const addTag = (tag: string) => {
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
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (showTagSuggestions && filteredTagSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev < filteredTagSuggestions.length - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        addTag(filteredTagSuggestions[selectedSuggestionIndex]);
        return;
      }
    }
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSave = () => {
    const finalTags = mergeInlineTags(tags, body);
    try {
      noteSchema.parse({ title, body, tags: finalTags });
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
      ...(note?.id && { id: note.id }),
      title,
      body,
      tags: finalTags,
    });
    setTags(finalTags);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    if (note) {
      setTitle(note.title || "");
      setBody(note.body || "");
      setTags(note.tags || []);
    }
    setIsEditMode(false);
    onCancel?.();
  };

  if (isEditMode) {
    return (
      <Card className="p-4 sm:p-6 space-y-4">
        <Input
          placeholder={t('notes.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold border-0 bg-transparent p-0 focus-visible:ring-0"
        />

        <MarkdownEditor
          value={body}
          onChange={setBody}
          placeholder={t('notes.startWriting')}
          availableTags={autocompleteTags}
        />

        <div className="flex items-center gap-3">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1 relative">
            <Input
              placeholder={t('journalEntry.addTagsPlaceholder')}
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value);
                setShowTagSuggestions(e.target.value.length > 0);
                setSelectedSuggestionIndex(0);
              }}
              onKeyDown={handleTagKeyDown}
              onFocus={() => setShowTagSuggestions(tagInput.length > 0)}
              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
              className="border-0 bg-transparent p-0 focus-visible:ring-0"
            />
            {showTagSuggestions && filteredTagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                {filteredTagSuggestions.map((tag, index) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTag(tag)}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${
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

        {(tags.length > 0 || inlineTags.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => setTags(tags.filter(t2 => t2 !== tag))}
              >
                {tag} ×
              </Badge>
            ))}
            {inlineTags.map(tag => (
              <Badge
                key={`inline-${tag}`}
                variant="outline"
                title={t('journalEntry.inlineTagBadgeHint')}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {t('notes.saveNote')}
          </Button>
        </div>
      </Card>
    );
  }

  if (!note) return null;

  return (
    <Card className="p-4 sm:p-6 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StickyNote className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {note.title ? (
            <h3 className="text-lg font-semibold truncate">{note.title}</h3>
          ) : (
            <h3 className="text-lg font-semibold text-muted-foreground italic truncate">{t('notes.title')}</h3>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setIsEditMode(true)} aria-label={t('common.edit')}>
            <Edit3 className="w-4 h-4" />
          </Button>
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" aria-label={t('common.delete')}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('notes.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('notes.deleteConfirmDesc')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(note.id)}>
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
          {note.body}
        </ReactMarkdown>
      </div>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {note.tags.map(tag => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('notes.updated', {
          date: format(note.updatedAt, 'PPp', { locale: getDateLocale(i18n.language) }),
        })}
      </p>
    </Card>
  );
};
