import { XMLParser } from "fast-xml-parser";

export type QtiChoice = { ident: string; text: string };

export type QtiBlank = {
  responseIdent: string;
  choices: QtiChoice[];
  correctIdent?: string;
};

export type QtiItem = {
  ident: string;
  questionType: string;
  pointsPossible?: number;
  promptHtml: string;
  responseIdent?: string;
  choices?: QtiChoice[];
  correctIdent?: string;
  shortAnswers?: string[];
  multiAnswer?: { required: string[]; forbidden: string[] };
  blanks?: QtiBlank[];
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: any): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  return node["__cdata"] ?? node["#text"] ?? "";
}

function buildHtmlFromMattext(mat: any): string {
  const baseText = textOf(mat);
  const imgs = mat?.img ? asArray(mat.img) : [];
  if (imgs.length === 0) return baseText;
  const imgHtml = imgs
    .map((img) => {
      const src = img?.["@_src"] ?? "";
      return src ? `<img src="${src}" />` : "";
    })
    .join("");
  return `${baseText}${imgHtml}`;
}

function getMattext(material: any): string {
  if (Array.isArray(material)) {
    const first = material[0];
    return getMattext(first);
  }
  const mat = material?.mattext ?? material;
  if (Array.isArray(mat)) return buildHtmlFromMattext(mat[0]?.mattext ?? mat[0]);
  return buildHtmlFromMattext(mat);
}

function parseMetadata(item: any): { questionType: string; pointsPossible?: number } {
  const fields = asArray(item?.itemmetadata?.qtimetadata?.qtimetadatafield);
  const map = new Map<string, string>();
  for (const field of fields) {
    const label = field?.fieldlabel;
    const entry = field?.fieldentry;
    if (label && entry) map.set(label, entry);
  }
  const questionType = map.get("question_type") ?? "unknown";
  const points = map.get("points_possible");
  const pointsPossible = points ? Number(points) : undefined;
  return { questionType, pointsPossible };
}

function parseChoices(responseLid: any): QtiChoice[] {
  const renderChoice = responseLid?.render_choice;
  const labels = asArray(renderChoice?.response_label);
  return labels.map((label) => ({
    ident: label?.["@_ident"] ?? "",
    text: getMattext(label?.material)
  }));
}

function collectRespconditions(resprocessing: any): any[] {
  return asArray(resprocessing?.respcondition);
}

function isScore100(cond: any): boolean {
  const setvar = cond?.setvar;
  if (!setvar) return false;
  const val = textOf(setvar).trim();
  return val === "100" || val === "100.0";
}

function parseVarequal(node: any): { respident?: string; value?: string }[] {
  return asArray(node).map((entry) => ({
    respident: entry?.["@_respident"],
    value: textOf(entry)
  }));
}

function findCorrectIdent(resprocessing: any, responseIdent: string): string | undefined {
  for (const cond of collectRespconditions(resprocessing)) {
    if (!isScore100(cond)) continue;
    const entries = parseVarequal(cond?.conditionvar?.varequal);
    for (const entry of entries) {
      if (entry.respident === responseIdent && entry.value) return entry.value;
    }
  }
  return undefined;
}

function findShortAnswers(resprocessing: any, responseIdent: string): string[] {
  const answers: string[] = [];
  for (const cond of collectRespconditions(resprocessing)) {
    if (!isScore100(cond)) continue;
    const entries = parseVarequal(cond?.conditionvar?.varequal);
    for (const entry of entries) {
      if (entry.respident === responseIdent && entry.value) {
        answers.push(entry.value);
      }
    }
  }
  return answers;
}

function findMultiAnswer(resprocessing: any, responseIdent: string): { required: string[]; forbidden: string[] } | null {
  for (const cond of collectRespconditions(resprocessing)) {
    if (!isScore100(cond)) continue;
    const andNode = cond?.conditionvar?.and;
    if (!andNode) continue;
    const required = parseVarequal(andNode?.varequal)
      .filter((entry) => entry.respident === responseIdent && entry.value)
      .map((entry) => entry.value as string);
    const forbidden = parseVarequal(andNode?.not?.varequal)
      .filter((entry) => entry.respident === responseIdent && entry.value)
      .map((entry) => entry.value as string);
    return { required, forbidden };
  }
  return null;
}

function findBlankCorrect(resprocessing: any, responseIdent: string): string | undefined {
  for (const cond of collectRespconditions(resprocessing)) {
    if (!isScore100(cond)) continue;
    const entries = parseVarequal(cond?.conditionvar?.varequal);
    for (const entry of entries) {
      if (entry.respident === responseIdent && entry.value) return entry.value;
    }
  }
  return undefined;
}

export function parseQtiXml(xml: string): QtiItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true,
    cdataPropName: "__cdata"
  });

  const doc = parser.parse(xml);
  const items = asArray(doc?.questestinterop?.assessment?.section?.item);
  const out: QtiItem[] = [];

  for (const item of items) {
    const ident = item?.["@_ident"] ?? "";
    const { questionType, pointsPossible } = parseMetadata(item);
    const presentation = item?.presentation ?? {};
    const material = presentation?.material ?? presentation?.material?.[0];
    const promptHtml = getMattext(material);

    if (questionType === "multiple_choice_question" || questionType === "true_false_question") {
      const responseLid = presentation?.response_lid;
      const responseIdent = responseLid?.["@_ident"] ?? "response1";
      const choices = parseChoices(responseLid);
      const correctIdent = findCorrectIdent(item?.resprocessing, responseIdent);
      out.push({
        ident,
        questionType,
        pointsPossible,
        promptHtml,
        responseIdent,
        choices,
        correctIdent
      });
      continue;
    }

    if (questionType === "multiple_answers_question") {
      const responseLid = presentation?.response_lid;
      const responseIdent = responseLid?.["@_ident"] ?? "response1";
      const choices = parseChoices(responseLid);
      const multiAnswer = findMultiAnswer(item?.resprocessing, responseIdent);
      out.push({
        ident,
        questionType,
        pointsPossible,
        promptHtml,
        responseIdent,
        choices,
        multiAnswer: multiAnswer ?? { required: [], forbidden: [] }
      });
      continue;
    }

    if (questionType === "short_answer_question") {
      const responseStr = presentation?.response_str ?? presentation?.response_lid;
      const responseIdent = responseStr?.["@_ident"] ?? "response1";
      const shortAnswers = findShortAnswers(item?.resprocessing, responseIdent);
      out.push({
        ident,
        questionType,
        pointsPossible,
        promptHtml,
        responseIdent,
        shortAnswers
      });
      continue;
    }

    if (questionType === "fill_in_multiple_blanks_question") {
      const responseLids = asArray(presentation?.response_lid);
      const blanks: QtiBlank[] = responseLids.map((responseLid) => {
        const responseIdent = responseLid?.["@_ident"] ?? "";
        const choices = parseChoices(responseLid);
        const correctIdent = findBlankCorrect(item?.resprocessing, responseIdent);
        return { responseIdent, choices, correctIdent };
      });
      out.push({
        ident,
        questionType,
        pointsPossible,
        promptHtml,
        blanks
      });
      continue;
    }

    out.push({
      ident,
      questionType,
      pointsPossible,
      promptHtml
    });
  }

  return out;
}
