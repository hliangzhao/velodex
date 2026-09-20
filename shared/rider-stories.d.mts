export type StoryDraft = {
  title: string;
  bike: string;
  scene: string;
  setup: string;
  reason: string;
  upgrade: string;
  lesson: string;
  photo: string;
};
export type RiderStory = StoryDraft & {
  id: string;
  author: string;
  url: string;
  createdAt: string;
};
export const storyFields: [keyof Omit<StoryDraft, 'photo'>, string, number][];
export const storyMarker: string;
export const consentMarker: string;
export function emptyStory(): StoryDraft;
export function safeStoryPhoto(value: string): string;
export function cleanStory(value: unknown, requireContent?: boolean): StoryDraft;
export function storyMarkdown(value: StoryDraft): string;
export function parseRiderStory(value: unknown): StoryDraft | null;
export function exportRiderStories(comments: unknown[]): RiderStory[];
