import { describe, it, expect } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import AdmZip from "adm-zip";
import { importCanvasZip } from "../src/importers/canvasQti/importCanvasZip.js";

const QUIZ_IDS = [
  "g7243b798f1481087f576c8f28f97341e",
  "g8ffb0eaace6d29d01a09f22ed7f014eb",
  "gbd1f041335fa7ac302d5fa88ce901d1d"
];

const QUIZ_TITLES = [
  "Quiz Các phương pháp đếm",
  "Quiz Các cấu trúc cơ bản",
  "Quiz Lý thuyết đồ thị"
];

function qtiHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2"><assessment ident="quiz"><section ident="root">`;
}

function qtiFooter(): string {
  return `</section></assessment></questestinterop>`;
}

function qtiMetadata(questionType: string, points = 1): string {
  return `
    <itemmetadata>
      <qtimetadata>
        <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${questionType}</fieldentry></qtimetadatafield>
        <qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
      </qtimetadata>
    </itemmetadata>`;
}

function qtiPrompt(text: string): string {
  return `<presentation><material><mattext texttype="text/html">${text}</mattext></material>`;
}

function qtiChoiceItem(id: string, questionType: string, choices: string[], correctIndex: number, extraPrompt = ""): string {
  const labels = choices
    .map((choice, idx) => `<response_label ident="c${idx + 1}"><material><mattext texttype="text/html">${choice}</mattext></material></response_label>`)
    .join("");
  return `
    <item ident="${id}">
      ${qtiMetadata(questionType)}
      ${qtiPrompt(`Prompt ${id} ${extraPrompt}`)}
        <response_lid ident="response1" rcardinality="Single">
          <render_choice>${labels}</render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
        <respcondition>
          <conditionvar><varequal respident="response1">c${correctIndex + 1}</varequal></conditionvar>
          <setvar varname="SCORE" action="Set">100</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
}

function qtiMultipleAnswers(id: string): string {
  const labels = ["Alpha", "Beta", "Gamma"]
    .map((choice, idx) => `<response_label ident="m${idx + 1}"><material><mattext texttype="text/html">${choice}</mattext></material></response_label>`)
    .join("");
  return `
    <item ident="${id}">
      ${qtiMetadata("multiple_answers_question")}
      ${qtiPrompt(`Prompt ${id}`)}
        <response_lid ident="response1" rcardinality="Multiple">
          <render_choice>${labels}</render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
        <respcondition>
          <conditionvar>
            <and>
              <varequal respident="response1">m1</varequal>
              <varequal respident="response1">m2</varequal>
              <not><varequal respident="response1">m3</varequal></not>
            </and>
          </conditionvar>
          <setvar varname="SCORE" action="Set">100</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
}

function qtiShortAnswer(id: string): string {
  return `
    <item ident="${id}">
      ${qtiMetadata("short_answer_question")}
      ${qtiPrompt(`Short answer ${id}`)}
        <response_str ident="response1" rcardinality="Single">
          <render_fib><response_label ident="answer1"/></render_fib>
        </response_str>
      </presentation>
      <resprocessing>
        <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
        <respcondition>
          <conditionvar><varequal respident="response1">42</varequal></conditionvar>
          <setvar varname="SCORE" action="Set">100</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
}

function qtiFillMultiBlank(id: string): string {
  return `
    <item ident="${id}">
      ${qtiMetadata("fill_in_multiple_blanks_question")}
      ${qtiPrompt(`Blank [ffn1] and [ffn2]`)}
        <response_lid ident="blank1" rcardinality="Single">
          <render_choice>
            <response_label ident="b1a"><material><mattext texttype="text/html">One</mattext></material></response_label>
            <response_label ident="b1b"><material><mattext texttype="text/html">Two</mattext></material></response_label>
          </render_choice>
        </response_lid>
        <response_lid ident="blank2" rcardinality="Single">
          <render_choice>
            <response_label ident="b2a"><material><mattext texttype="text/html">Red</mattext></material></response_label>
            <response_label ident="b2b"><material><mattext texttype="text/html">Blue</mattext></material></response_label>
          </render_choice>
        </response_lid>
      </presentation>
      <resprocessing>
        <outcomes><decvar varname="SCORE" vartype="Decimal" minvalue="0" maxvalue="100"/></outcomes>
        <respcondition>
          <conditionvar><varequal respident="blank1">b1b</varequal></conditionvar>
          <setvar varname="SCORE" action="Set">100</setvar>
        </respcondition>
        <respcondition>
          <conditionvar><varequal respident="blank2">b2a</varequal></conditionvar>
          <setvar varname="SCORE" action="Set">100</setvar>
        </respcondition>
      </resprocessing>
    </item>`;
}

function buildQti(items: string[]): string {
  return `${qtiHeader()}${items.join("\n")}${qtiFooter()}`;
}

function buildMeta(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <quiz xmlns="http://canvas.instructure.com/xsd/cccv1p0">
    <title>${title}</title>
  </quiz>`;
}

function buildManifest(): string {
  const resourceEntries = QUIZ_IDS.map(
    (id) => `
    <resource identifier="${id}" type="imsqti_xmlv1p2" href="${id}/${id}.xml">
      <file href="${id}/${id}.xml"/>
      <dependency identifierref="${id}meta"/>
    </resource>
    <resource identifier="${id}meta" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="${id}/assessment_meta.xml">
      <file href="${id}/assessment_meta.xml"/>
    </resource>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
  <manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1">
    <resources>
      ${resourceEntries}
      <resource identifier="web1" type="webcontent" href="web_resources/Uploaded Media 2/non-iso-8nodes-deg2.png">
        <file href="web_resources/Uploaded Media 2/non-iso-8nodes-deg2.png"/>
      </resource>
    </resources>
  </manifest>`;
}

describe("importCanvasZip fixture", () => {
  it("parses fixture layout with expected counts", async () => {
    const tmpDir = resolve("packages/shared/tests/.tmp");
    mkdirSync(tmpDir, { recursive: true });
    const zipPath = join(tmpDir, "canvas-fixture.zip");

    const zip = new AdmZip();
    const itemsQuiz1: string[] = [];
    const itemsQuiz2: string[] = [];
    const itemsQuiz3: string[] = [];

    for (let i = 0; i < 10; i += 1) {
      const extra = i === 0 ? `<img src="$IMS-CC-FILEBASE$/Uploaded%20Media%202/non-iso-8nodes-deg2.png" />` : "";
      itemsQuiz1.push(qtiChoiceItem(`mcq1_${i}`, "multiple_choice_question", ["A", "B", "C"], 1, extra));
    }
    for (let i = 0; i < 6; i += 1) itemsQuiz2.push(qtiChoiceItem(`mcq2_${i}`, "multiple_choice_question", ["A", "B", "C"], 2));
    for (let i = 0; i < 6; i += 1) itemsQuiz3.push(qtiChoiceItem(`mcq3_${i}`, "multiple_choice_question", ["A", "B", "C"], 0));

    for (let i = 0; i < 2; i += 1) itemsQuiz1.push(qtiChoiceItem(`tf1_${i}`, "true_false_question", ["True", "False"], 0));
    for (let i = 0; i < 2; i += 1) itemsQuiz2.push(qtiChoiceItem(`tf2_${i}`, "true_false_question", ["True", "False"], 1));
    for (let i = 0; i < 2; i += 1) itemsQuiz3.push(qtiChoiceItem(`tf3_${i}`, "true_false_question", ["True", "False"], 0));

    for (let i = 0; i < 7; i += 1) itemsQuiz1.push(qtiMultipleAnswers(`multi1_${i}`));
    for (let i = 0; i < 6; i += 1) itemsQuiz2.push(qtiMultipleAnswers(`multi2_${i}`));
    for (let i = 0; i < 6; i += 1) itemsQuiz3.push(qtiMultipleAnswers(`multi3_${i}`));

    itemsQuiz1.push(qtiShortAnswer("short1"));

    for (let i = 0; i < 5; i += 1) itemsQuiz1.push(qtiFillMultiBlank(`blank1_${i}`));
    for (let i = 0; i < 5; i += 1) itemsQuiz2.push(qtiFillMultiBlank(`blank2_${i}`));
    for (let i = 0; i < 5; i += 1) itemsQuiz3.push(qtiFillMultiBlank(`blank3_${i}`));

    zip.addFile(`${QUIZ_IDS[0]}/${QUIZ_IDS[0]}.xml`, Buffer.from(buildQti(itemsQuiz1), "utf8"));
    zip.addFile(`${QUIZ_IDS[0]}/assessment_meta.xml`, Buffer.from(buildMeta(QUIZ_TITLES[0]), "utf8"));
    zip.addFile(`${QUIZ_IDS[1]}/${QUIZ_IDS[1]}.xml`, Buffer.from(buildQti(itemsQuiz2), "utf8"));
    zip.addFile(`${QUIZ_IDS[1]}/assessment_meta.xml`, Buffer.from(buildMeta(QUIZ_TITLES[1]), "utf8"));
    zip.addFile(`${QUIZ_IDS[2]}/${QUIZ_IDS[2]}.xml`, Buffer.from(buildQti(itemsQuiz3), "utf8"));
    zip.addFile(`${QUIZ_IDS[2]}/assessment_meta.xml`, Buffer.from(buildMeta(QUIZ_TITLES[2]), "utf8"));

    zip.addFile(
      "web_resources/Uploaded Media 2/non-iso-8nodes-deg2.png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47])
    );
    zip.addFile("imsmanifest.xml", Buffer.from(buildManifest(), "utf8"));
    zip.writeZip(zipPath);

    const result = await importCanvasZip(zipPath, {
      courseCode: "MAT3500",
      subject: "discrete-math"
    });

    const totalQuestions = result.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
    const mcqCount = result.quizzes.reduce(
      (sum, quiz) => sum + quiz.questions.filter((q: any) => q.type === "mcq-single").length,
      0
    );
    const fillCount = result.quizzes.reduce(
      (sum, quiz) => sum + quiz.questions.filter((q: any) => q.type === "fill-blank").length,
      0
    );

    expect(result.quizzes.length).toBe(3);
    expect(totalQuestions).toBe(63);
    expect(mcqCount).toBe(28);
    expect(fillCount).toBe(35);
    expect(result.assets.some((asset) => asset.zipPath === "web_resources/Uploaded Media 2/non-iso-8nodes-deg2.png")).toBe(
      true
    );

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
