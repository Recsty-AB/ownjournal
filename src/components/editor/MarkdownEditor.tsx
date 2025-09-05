import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Edit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const MarkdownEditor = ({ value, onChange, placeholder }: MarkdownEditorProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="edit" className="flex items-center gap-2">
          <Edit className="w-4 h-4" />
          {t('editor.edit')}
        </TabsTrigger>
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          {t('editor.preview')}
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="edit" className="mt-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || t('editor.placeholder')}
          className="min-h-[300px] font-mono text-sm"
        />
        <div className="mt-2 text-xs text-muted-foreground">
          {t('editor.markdownSupport')}
        </div>
      </TabsContent>
      
      <TabsContent value="preview" className="mt-2">
        <div className="min-h-[300px] p-4 border rounded-lg bg-background prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {value || t('editor.noContentPreview')}
          </ReactMarkdown>
        </div>
      </TabsContent>
    </Tabs>
  );
};
