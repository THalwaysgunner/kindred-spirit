import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

interface TiptapEditorProps {
    value: string;
    onChange: (value: string) => void;
}

export const TiptapEditor = ({ value, onChange }: TiptapEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: {
                    HTMLAttributes: {
                        class: 'list-disc pl-8 mb-2 space-y-1',
                    },
                },
                orderedList: {
                    HTMLAttributes: {
                        class: 'list-decimal pl-8 mb-2 space-y-1',
                    },
                },
                paragraph: {
                    HTMLAttributes: {
                        class: 'mb-2 text-slate-900 text-sm',
                    },
                },
                heading: {
                    HTMLAttributes: {
                        class: 'font-bold text-slate-900 mb-1 mt-4 block text-sm',
                    }
                }
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'w-full focus:outline-none min-h-[300px] p-4 text-slate-900 text-sm leading-normal',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Handle external value changes (optional, usually Tiptap handles its own state)
    // But for initial load or potential reset:
    useEffect(() => {
        if (editor && value && editor.getHTML() !== value) {
            // Only update if content is significantly different to avoid cursor jumps
            // Ideally we trust Tiptap's internal state after init
            if (editor.getText() === '') {
                editor.commands.setContent(value)
            }
        }
    }, [value, editor]);

    if (!editor) {
        return null;
    }

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 transition-all bg-white">
            {/* Simple Toolbar */}
            <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 p-2">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 ${editor.isActive('bold') ? 'bg-slate-200 text-slate-900 font-bold' : ''}`}
                    title="Bold"
                >
                    <strong>B</strong>
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 italic ${editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : ''}`}
                    title="Italic"
                >
                    I
                </button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded hover:bg-slate-200 text-slate-600 ${editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900' : ''}`}
                    title="Bullet List"
                >
                    • List
                </button>
            </div>

            <EditorContent editor={editor} />
        </div>
    );
};
