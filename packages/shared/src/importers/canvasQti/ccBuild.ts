import { createHash } from "node:crypto";
import { XMLBuilder } from "fast-xml-parser";
import AdmZip from "adm-zip";
import { AnswerKey, ImportOptions, QuizJson } from "../latex/latexParse.js";
import { ImportedAsset } from "../shared/assets.js";
import { buildQtiXml } from "./qtiBuild.js";

const MANIFEST_NS = "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1";
const CANVAS_NS = "http://canvas.instructure.com/xsd/cccv1p0";

function md5Hex(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function buildAssessmentMeta(title: string, pointsPossible: number): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: true
  });
  return builder.build({
    quiz: {
      "@_xmlns": CANVAS_NS,
      title,
      description: "",
      points_possible: String(pointsPossible),
      shuffle_answers: "false",
      allowed_attempts: "-1",
      scoring_policy: "keep_highest",
      one_question_at_a_time: "false",
      cant_go_back: "false",
      show_correct_answers: "true",
      one_time_results: "false"
    }
  });
}

function buildManifest(
  quizEntries: { hash: string; qtiPath: string; metaPath: string }[],
  assets: ImportedAsset[]
): string {
  const resources: any[] = [];
  for (const quiz of quizEntries) {
    resources.push({
      "@_identifier": quiz.hash,
      "@_type": "imsqti_xmlv1p2",
      "@_href": quiz.qtiPath,
      file: { "@_href": quiz.qtiPath },
      dependency: { "@_identifierref": `${quiz.hash}meta` }
    });
    resources.push({
      "@_identifier": `${quiz.hash}meta`,
      "@_type": "associatedcontent/imscc_xmlv1p1/learning-application-resource",
      "@_href": quiz.metaPath,
      file: { "@_href": quiz.metaPath }
    });
  }

  assets.forEach((asset, index) => {
    resources.push({
      "@_identifier": `webcontent_${index + 1}`,
      "@_type": "webcontent",
      "@_href": asset.zipPath,
      file: { "@_href": asset.zipPath }
    });
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    format: true
  });

  return builder.build({
    manifest: {
      "@_xmlns": MANIFEST_NS,
      "@_identifier": "manifest",
      resources: {
        resource: resources
      }
    }
  });
}

export async function exportCanvasZip(
  quizzes: QuizJson[],
  answerKey: AnswerKey,
  assets: ImportedAsset[],
  opts: ImportOptions
): Promise<Buffer> {
  const zip = new AdmZip();
  const quizEntries: { hash: string; qtiPath: string; metaPath: string }[] = [];
  const warnings: string[] = [];

  for (const quiz of quizzes) {
    const versionId = quiz.version.versionId ?? "quiz";
    const hash = `g${md5Hex(versionId)}`;
    const qtiPath = `${hash}/${hash}.xml`;
    const metaPath = `${hash}/assessment_meta.xml`;

    const qti = buildQtiXml(quiz, answerKey, assets, opts);
    warnings.push(...qti.warnings);

    zip.addFile(qtiPath, Buffer.from(qti.xml, "utf8"));

    const pointsPossible = qti.itemCount;
    const metaXml = buildAssessmentMeta(versionId, pointsPossible);
    zip.addFile(metaPath, Buffer.from(metaXml, "utf8"));

    quizEntries.push({ hash, qtiPath, metaPath });
  }

  for (const asset of assets) {
    zip.addFile(asset.zipPath, asset.bytes);
  }

  const manifest = buildManifest(quizEntries, assets);
  zip.addFile("imsmanifest.xml", Buffer.from(manifest, "utf8"));

  return zip.toBuffer();
}
