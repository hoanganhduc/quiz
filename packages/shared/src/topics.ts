export type TopicDefinition = {
  id: string;
  title: string;
};

export type TopicCategory = {
  id: string;
  title: string;
  subtopics: TopicDefinition[];
};

export const topicCatalog: TopicCategory[] = [
  {
    id: "logic-and-proofs",
    title: "Logic & Proofs",
    subtopics: [
      { id: "propositional", title: "Propositional Logic" },
      { id: "predicate", title: "Predicate Logic" },
      { id: "proof", title: "Proofs" }
    ]
  },
  {
    id: "basic-structures",
    title: "Basic Structures",
    subtopics: [
      { id: "set", title: "Sets" },
      { id: "function", title: "Functions" },
      { id: "sequence", title: "Sequences" },
      { id: "sum", title: "Summations" }
    ]
  },
  {
    id: "algorithms",
    title: "Algorithms",
    subtopics: [
      { id: "algo", title: "Algorithms" },
      { id: "fgrowth", title: "Function Growth" }
    ]
  },
  {
    id: "induction-recursion",
    title: "Induction & Recursion",
    subtopics: [
      { id: "induction", title: "Mathematical Induction" },
      { id: "recursion", title: "Recursion" }
    ]
  },
  {
    id: "graph-theory",
    title: "Graph Theory",
    subtopics: [{ id: "gt", title: "Graph Theory" }]
  },
  {
    id: "number-theory",
    title: "Number Theory",
    subtopics: [{ id: "nb", title: "Number Theory" }]
  },
  {
    id: "counting",
    title: "Counting",
    subtopics: [{ id: "counting", title: "Counting" }]
  },
  {
    id: "boolean-algebra",
    title: "Boolean Algebra",
    subtopics: [{ id: "boolean", title: "Boolean Algebra" }]
  }
];

const topicLookup = new Map<string, { title: string; categoryId: string }>();
for (const category of topicCatalog) {
  for (const topic of category.subtopics) {
    topicLookup.set(topic.id.toLowerCase(), { title: topic.title, categoryId: category.id });
  }
}

const categoryLookup = new Map<string, TopicCategory>();
for (const category of topicCatalog) {
  categoryLookup.set(category.id.toLowerCase(), category);
}

function toTitleCase(topic: string): string {
  return topic
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getTopicTitle(topic: string): string {
  const normalized = topic.trim().toLowerCase();
  const entry = topicLookup.get(normalized);
  if (entry) return entry.title;
  return toTitleCase(normalized);
}

export function getTopicCategory(topic: string): TopicCategory | undefined {
  const normalized = topic.trim().toLowerCase();
  const entry = topicLookup.get(normalized);
  if (!entry) return undefined;
  return topicCatalog.find((category) => category.id === entry.categoryId);
}

export function getCategoryById(id: string): TopicCategory | undefined {
  return categoryLookup.get(id.trim().toLowerCase());
}

export function getSubtopicsForCategory(categoryId: string): TopicDefinition[] {
  return getCategoryById(categoryId)?.subtopics ?? [];
}

export function getSubtopicIdsForCategory(categoryId: string): string[] {
  return getSubtopicsForCategory(categoryId).map((topic) => topic.id);
}

export function isTopicCategory(value: string): boolean {
  return categoryLookup.has(value.trim().toLowerCase());
}
