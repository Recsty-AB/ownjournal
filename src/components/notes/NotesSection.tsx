import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      {/* Toolbar: find, write. Same shape as the journal timeline's. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('notes.searchPlaceholder')}
            aria-label={t('notes.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-full border-border bg-card pl-11 pr-4 shadow-soft"
          />
        </div>
        <Button
          onClick={() => setShowNewNote(true)}
          disabled={showNewNote}
          className="h-11 flex-grow rounded-full px-5 bg-gradient-primary shadow-glow sm:flex-grow-0"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
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
        <div className="mx-auto max-w-md px-2 py-12 text-center sm:py-20">
          <StickyNote aria-hidden="true" className="mx-auto mb-6 h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
          <h3 className="mb-2 text-2xl font-semibold text-foreground">{t('notes.emptyTitle')}</h3>
          <p className="mb-8 text-muted-foreground">{t('notes.emptyDesc')}</p>
          <Button variant="outline" onClick={() => setShowNewNote(true)} className="h-11 rounded-full px-6">
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t('notes.newNote')}
          </Button>
        </div>
      ) : (
        <>
          {filteredNotes.length === 0 && notes.length > 0 && (
            <p className="py-12 text-center text-muted-foreground">{t('notes.noSearchResults')}</p>
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
