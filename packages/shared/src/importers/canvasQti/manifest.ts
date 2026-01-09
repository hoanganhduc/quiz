import { XMLParser } from "fast-xml-parser";

export type ManifestQuizResource = {
  identifier: string;
  qtiPath: string;
  metaPath?: string;
};

export type ManifestInfo = {
  quizResources: ManifestQuizResource[];
  webResources: string[];
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseManifest(xml: string): ManifestInfo {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true
  });
  const doc = parser.parse(xml);
  const manifest = doc.manifest ?? doc;
  const resources = asArray(manifest?.resources?.resource);

  const metaById = new Map<string, string>();
  const webResources: string[] = [];

  for (const res of resources) {
    const type = res?.["@_type"];
    const identifier = res?.["@_identifier"];
    const file = asArray(res?.file)?.[0];
    const href = file?.["@_href"] ?? res?.["@_href"];

    if (type === "associatedcontent/imscc_xmlv1p1/learning-application-resource" && identifier && href) {
      metaById.set(identifier, href);
    }

    if (type === "webcontent" && href) {
      webResources.push(href);
    }
  }

  const quizResources: ManifestQuizResource[] = [];

  for (const res of resources) {
    const type = res?.["@_type"];
    if (type !== "imsqti_xmlv1p2") continue;
    const identifier = res?.["@_identifier"];
    const file = asArray(res?.file)?.[0];
    const qtiPath = file?.["@_href"];
    if (!identifier || !qtiPath) continue;
    const dependency = asArray(res?.dependency)?.[0];
    const metaRef = dependency?.["@_identifierref"];
    const metaPath = metaRef ? metaById.get(metaRef) : undefined;
    quizResources.push({ identifier, qtiPath, metaPath });
  }

  return { quizResources, webResources };
}
