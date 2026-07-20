import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NoteCard, NoteSaveData } from "./NoteCard";
import type { JournalEntryData } from "@/components/journal/JournalEntry";

interface NotesSectionProps {
  notes: JournalEntryData[];
  /** All known tags (journal + notes) for suggestions and inline autocomplete. */
  allTags: string[];
  onSaveNote: (note: NoteSaveData) => void;
  onDeleteNote: (id: string) => void;
}

export const NotesSection = ({ notes, allTags, onSaveNote, onDeleteNote }: NotesSectionProps) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showNewNote, setShowNewNote] = useState(false);

  const filteredNotes = useMemo(() => {
    const sorted = [...notes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const query = search.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(note =>
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query) ||
      note.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [notes, search]);

  const handleSaveNew = (note: NoteSaveData) => {
    onSaveNote(note);
    setShowNewNote(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('notes.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowNewNote(true)} disabled={showNewNote}>
          <Plus className="w-4 h-4 mr-2" />
          {t('notes.newNote')}
        </Button>
      </div>

      {showNewNote && (
        <NoteCard
          allTags={allTags}
          onSave={handleSaveNew}
          onCancel={() => setShowNewNote(false)}
          isEditing
        />
      )}

      {notes.length === 0 && !showNewNote ? (
        <Card className="p-8 sm:p-12 text-center space-y-3">
          <StickyNote className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('notes.emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('notes.emptyDesc')}</p>
          <Button onClick={() => setShowNewNote(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('notes.newNote')}
          </Button>
        </Card>
      ) : (
        <>
          {filteredNotes.length === 0 && notes.length > 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('notes.noSearchResults')}</p>
          )}
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              allTags={allTags}
              onSave={onSaveNote}
              onDelete={onDeleteNote}
            />
          ))}
        </>
      )}
    </div>
  );
};
