import { createHash } from "node:crypto";
import { XMLBuilder } from "fast-xml-parser";
import { AnswerKey, ImportOptions, QuizJson } from "../latex/latexParse.js";
import { encodeFilebasePath, buildAssetNameLookup, ImportedAsset } from "../shared/assets.js";

const QTI_NAMESPACE = "http://www.imsglobal.org/xsd/ims_qtiasiv1p2";

function md5Hex(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function buildMattext(html: string): any {
  return {
    mattext: {
      "@_texttype": "text/html",
      "__cdata": html
    }
  };
}

function promptToHtml(prompt: string, assets: ImportedAsset[], warnings: string[]): string {
  const assetMap = buildAssetNameLookup(assets);
  let html = prompt.replace(/\[image:\s*([^\]]+)\]/g, (match, name) => {
    const asset = assetMap.get(String(name).trim());
    if (!asset) {
      warnings.push(`Missing asset for placeholder ${match}`);
      return match;
    }
    const path = encodeFilebasePath(asset.zipPath);
    return `<img src="$IMS-CC-FILEBASE$/${path}" />`;
  });
  html = html.replace(/\r?\n/g, "<br/>");
  return `<p>${html}</p>`;
}

function buildMetadata(questionType: string, pointsPossible: number): any {
  return {
    itemmetadata: {
      qtimetadata: {
        qtimetadatafield: [
          { fieldlabel: "question_type", fieldentry: questionType },
          { fieldlabel: "points_possible", fieldentry: String(pointsPossible) }
        ]
      }
    }
  };
}

function buildOutcomes(): any {
  return {
    outcomes: {
      decvar: { "@_varname": "SCORE", "@_vartype": "Decimal", "@_minvalue": "0", "@_maxvalue": "100" }
    }
  };
}

function buildCorrectRespcondition(responseIdent: string, correctIdent: string): any {
  return {
    respcondition: {
      conditionvar: { varequal: { "@_respident": responseIdent, "#text": correctIdent } },
      setvar: { "@_varname": "SCORE", "@_action": "Set", "#text": "100" }
    }
  };
}

function buildShortAnswerRespconditions(responseIdent: string, answers: string[]): any[] {
  return answers.map((answer) => ({
    respcondition: {
      conditionvar: { varequal: { "@_respident": responseIdent, "#text": answer } },
      setvar: { "@_varname": "SCORE", "@_action": "Set", "#text": "100" }
    }
  }));
}

function choiceLabelIdent(questionIndex: number, choiceIndex: number): string {
  return String((questionIndex + 1) * 1000 + choiceIndex + 1);
}

export function buildQtiXml(
  quiz: QuizJson,
  answerKey: AnswerKey,
  assets: ImportedAsset[],
  opts: ImportOptions
): { xml: string; warnings: string[]; itemCount: number } {
  const warnings: string[] = [];
  const items: any[] = [];
  const delimiter = opts.combinedDelimiter ?? "; ";
  const fillMode = opts.fillBlankExportMode ?? "combined_short_answer";

  quiz.questions.forEach((q: any, index: number) => {
    const itemIdent = `q_${md5Hex(q.uid).slice(0, 12)}`;
    const pointsPossible =
      answerKey[q.uid] && "points" in answerKey[q.uid] && typeof answerKey[q.uid].points === "number"
        ? Number(answerKey[q.uid].points)
        : 1;
    const promptHtml = promptToHtml(q.prompt ?? "", assets, warnings);

    if (q.type === "mcq-single") {
      const key = answerKey[q.uid]?.type === "mcq-single" ? answerKey[q.uid].correctKey : undefined;
      const responseIdent = "response1";
      const choicesRaw = q.choices ?? [];
      const choices = choicesRaw.map((choice: any, cIndex: number) => ({
        "@_ident": choiceLabelIdent(index, cIndex),
        material: buildMattext(promptToHtml(String(choice.text ?? ""), [], warnings))
      }));
      const correctIdent = key
        ? choices.find((_, cIndex) => choicesRaw[cIndex]?.key === key)?.["@_ident"]
        : undefined;
      if (!correctIdent) {
        warnings.push(`Missing correct choice for ${q.uid}`);
      }

      items.push({
        "@_ident": itemIdent,
        ...buildMetadata("multiple_choice_question", pointsPossible),
        presentation: {
          material: buildMattext(promptHtml),
          response_lid: {
            "@_ident": responseIdent,
            "@_rcardinality": "Single",
            render_choice: {
              response_label: choices
            }
          }
        },
        resprocessing: {
          ...buildOutcomes(),
          ...(correctIdent ? buildCorrectRespcondition(responseIdent, correctIdent) : {})
        }
      });
      return;
    }

    if (q.type === "fill-blank") {
      const key = answerKey[q.uid];
      const accepted = key && key.type === "fill-blank" ? key.acceptedAnswers ?? [] : [];
      const responseIdent = "response1";
      const blankCount = q.blankCount ?? 1;

      if (blankCount > 1 && fillMode === "split_items") {
        for (let b = 0; b < blankCount; b += 1) {
          const splitIdent = `q_${md5Hex(`${q.uid}:${b}`).slice(0, 12)}`;
          const splitPrompt = `${q.prompt}\n\nBlank ${b + 1}: \\underline{\\qquad}`;
          const splitHtml = promptToHtml(splitPrompt, assets, warnings);
          const answers = accepted[b] ? [accepted[b]] : [];
          if (answers.length === 0) {
            warnings.push(`Missing accepted answer for ${q.uid} blank ${b + 1}`);
          }
          items.push({
            "@_ident": splitIdent,
            ...buildMetadata("short_answer_question", pointsPossible),
            presentation: {
              material: buildMattext(splitHtml),
              response_str: {
                "@_ident": responseIdent,
                "@_rcardinality": "Single",
                render_fib: { response_label: { "@_ident": "answer1" } }
              }
            },
            resprocessing: {
              ...buildOutcomes(),
              respcondition: buildShortAnswerRespconditions(responseIdent, answers).map((c) => c.respcondition)
            }
          });
        }
        warnings.push(`Split fill-blank item into ${blankCount} items for ${q.uid}`);
        return;
      }

      let prompt = q.prompt ?? "";
      if (blankCount > 1) {
        prompt = `${prompt}\n\nEnter answers separated by ${delimiter}\nAnswer: \\underline{\\qquad}`;
      }
      const combinedAnswers =
        blankCount > 1 && accepted.length >= blankCount ? [accepted.slice(0, blankCount).join(delimiter)] : accepted;
      if (combinedAnswers.length === 0) {
        warnings.push(`Missing accepted answers for ${q.uid}`);
      }

      items.push({
        "@_ident": itemIdent,
        ...buildMetadata("short_answer_question", pointsPossible),
        presentation: {
          material: buildMattext(promptToHtml(prompt, assets, warnings)),
          response_str: {
            "@_ident": responseIdent,
            "@_rcardinality": "Single",
            render_fib: { response_label: { "@_ident": "answer1" } }
          }
        },
        resprocessing: {
          ...buildOutcomes(),
          respcondition: buildShortAnswerRespconditions(responseIdent, combinedAnswers).map((c) => c.respcondition)
        }
      });
    }
  });

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    cdataPropName: "__cdata",
    format: true
  });

  const xml = builder.build({
    questestinterop: {
      "@_xmlns": QTI_NAMESPACE,
      assessment: {
        "@_ident": quiz.version.versionId ?? "assessment",
        section: { "@_ident": "root_section", item: items }
      }
    }
  });

  return { xml, warnings, itemCount: items.length };
}
