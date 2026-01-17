const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'admin', 'SourcesManagerPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update validateAndNormalizeConfig
const oldValidation = `  const courseCode = cfg.courseCode.trim();
  const subject = cfg.subject.trim();
  const uidNamespace = cfg.uidNamespace.trim();
  if (!courseCode) fail("courseCode", "Required");
  if (!subject) fail("subject", "Required");
  if (!uidNamespace) fail("uidNamespace", "Required");`;

const newValidation = `  const courseCode = cfg.courseCode.trim();
  const uidNamespace = cfg.uidNamespace.trim();
  if (!courseCode) fail("courseCode", "Required");
  if (!uidNamespace) fail("uidNamespace", "Required");

  if (cfg.subjects) {
    const subIds = new Set<string>();
    for (const [idx, sub] of cfg.subjects.entries()) {
      const id = (sub.id || "").trim();
      const title = (sub.title || "").trim();
      if (!id) fail(\`subjects.\${idx}.id\`, "Required");
      if (!title) fail(\`subjects.\${idx}.title\`, "Required");
      if (subIds.has(id)) fail(\`subjects.\${idx}.id\`, "Subject ID must be unique");
      subIds.add(id);
    }
  }`;

content = content.replace(oldValidation, newValidation);

// 2. Update validateAndNormalizeConfig return
const oldReturn = `  return { version: "v1", courseCode, subject, uidNamespace, sources };`;
const newReturn = `  return {
    version: "v1",
    courseCode,
    subject: cfg.subject,
    subjects: cfg.subjects,
    uidNamespace,
    sources
  };`;

content = content.replace(oldReturn, newReturn);

// 3. Add state to SourcesManagerPage
const oldState = `  const [authEnabled, setAuthEnabled] = useState(false);
  const [authKind, setAuthKind] = useState<SourceDraftAuthKind>("githubToken");
  const [secretRef, setSecretRef] = useState("");`;

const newState = `  const [authEnabled, setAuthEnabled] = useState(false);
  const [authKind, setAuthKind] = useState<SourceDraftAuthKind>("githubToken");
  const [secretRef, setSecretRef] = useState("");
  const [sourceSubjectId, setSourceSubjectId] = useState("");

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [subjectEditingIndex, setSubjectEditingIndex] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [subjectTitle, setSubjectTitle] = useState("");`;

content = content.replace(oldState, newState);

// 4. Update closeSourceModal reset
const oldCloseModal = `    setAuthEnabled(false);
    setAuthKind("githubToken");
    setSecretRef("");
  };`;
const newCloseModal = `    setAuthEnabled(false);
    setAuthKind("githubToken");
    setSecretRef("");
    setSourceSubjectId("");
  };`;

content = content.replace(oldCloseModal, newCloseModal);

// 5. Update openSourceModal setup
const oldOpenModalPart = `      setSourceId(src.id ?? "");
      setSourceDir(src.dir ?? "");`;
const newOpenModalPart = `      setSourceId(src.id ?? "");
      setSourceDir(src.dir ?? "");
      setSourceSubjectId(src.subjectId ?? "");`;

content = content.replace(oldOpenModalPart, newOpenModalPart);

const oldOpenModalEmpty = `      setSourceDir("");
      setGithubRepo("");`;
const newOpenModalEmpty = `      setSourceDir("");
      setSourceSubjectId("");
      setGithubRepo("");`;

content = content.replace(oldOpenModalEmpty, newOpenModalEmpty);

// 6. Update saveSourceDraft
const oldSaveDraftSource = `          dir: dirTrimmed || ".",
          format: githubFormat,
          auth: authEnabled ? { kind: "githubToken", secretRef: secretRef.trim() } : undefined`;
const newSaveDraftSource = `          dir: dirTrimmed || ".",
          format: githubFormat,
          subjectId: sourceSubjectId,
          auth: authEnabled ? { kind: "githubToken", secretRef: secretRef.trim() } : undefined`;

content = content.replace(oldSaveDraftSource, newSaveDraftSource);

const oldSaveDraftSourceGDrive = `          folderId: driveFolderId.trim(),
          format: driveFormat,
          auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined`;
const newSaveDraftSourceGDrive = `          folderId: driveFolderId.trim(),
          format: driveFormat,
          subjectId: sourceSubjectId,
          auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined`;

content = content.replace(oldSaveDraftSourceGDrive, newSaveDraftSourceGDrive);

const oldSaveDraftSourceZip = `          dir: dirTrimmed ? dirTrimmed : undefined,
          format: zipFormat,
          auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined`;
const newSaveDraftSourceZip = `          dir: dirTrimmed ? dirTrimmed : undefined,
          format: zipFormat,
          subjectId: sourceSubjectId,
          auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined`;

content = content.replace(oldSaveDraftSourceZip, newSaveDraftSourceZip);

// 7. Add Subject management functions and UI components
// This is more complex, I'll insert it before the return in SourcesManagerPage
const subjectHandlers = `
  const openSubjectModal = (index?: number) => {
    setSubjectModalNotice(null);
    if (index !== undefined && config?.subjects) {
      setSubjectEditingIndex(index);
      setSubjectId(config.subjects[index].id);
      setSubjectTitle(config.subjects[index].title);
    } else {
      setSubjectEditingIndex(null);
      setSubjectId("");
      setSubjectTitle("");
    }
    setSubjectModalOpen(true);
  };

  const closeSubjectModal = () => {
    setSubjectModalOpen(false);
    setSubjectEditingIndex(null);
    setSubjectId("");
    setSubjectTitle("");
  };

  const saveSubjectDraft = () => {
    if (!config) return;
    const cleanId = subjectId.trim();
    const cleanTitle = subjectTitle.trim();
    if (!cleanId || !cleanTitle) {
      setNotice({ tone: "error", text: "Subject ID and Title are required." });
      return;
    }

    const nextSubjects = config.subjects ? [...config.subjects] : [];
    if (subjectEditingIndex === null) {
      nextSubjects.push({ id: cleanId, title: cleanTitle });
    } else {
      nextSubjects[subjectEditingIndex] = { id: cleanId, title: cleanTitle };
    }

    try {
      const validated = validateAndNormalizeConfig({ ...config, subjects: nextSubjects });
      setConfig(validated);
      setNotice({ tone: "success", text: "Updated subjects list (not saved yet)" });
      closeSubjectModal();
    } catch (err: any) {
       setNotice({ tone: "error", text: err.message });
    }
  };

  const confirmAndDeleteSubject = (index: number) => {
    if (!config || !config.subjects) return;
    const sub = config.subjects[index];
    if (window.confirm(\`Delete subject "\${sub.title}" (\${sub.id})?\`)) {
      const next = { ...config, subjects: config.subjects.filter((_, i) => i !== index) };
      setConfig(next);
      setNotice({ tone: "success", text: \`Removed subject: \${sub.id} (not saved yet)\` });
    }
  };
`;

// Insert after runTest function
content = content.replace('  };\n\n  return (', `  };\n${subjectHandlers}\n  return (`);

// 8. Add Subject UI to the config section
// Find the "UID Namespace" input and add subjects below it.
const uidNamespaceInput = `<div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="uid-namespace">
                  UID Namespace
                </label>
                <Input
                  id="uid-namespace"
                  value={config?.uidNamespace ?? ""}
                  onChange={(e) => setConfig({ ...config!, uidNamespace: e.target.value })}
                  placeholder="e.g. math-dept"
                  disabled={configSaving}
                />
              </div>`;

const subjectsUI = `
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-text">Subjects</h3>
                  <Button type="button" size="sm" variant="secondary" onClick={() => openSubjectModal()} disabled={configSaving}>
                    Add Subject
                  </Button>
                </div>
                {!config?.subjects?.length ? (
                  <p className="text-xs text-textMuted italic">No subjects defined. Default "discrete-math" will be used.</p>
                ) : (
                  <div className="grid gap-2">
                    {config.subjects.map((sub, idx) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-md border border-border p-2 bg-muted/30">
                        <div>
                          <div className="text-sm font-medium">{sub.title}</div>
                          <div className="text-xs text-textMuted font-mono">{sub.id}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" size="xs" variant="ghost" onClick={() => openSubjectModal(idx)} disabled={configSaving}>
                            Edit
                          </Button>
                          <Button type="button" size="xs" variant="ghost" className="text-danger" onClick={() => confirmAndDeleteSubject(idx)} disabled={configSaving}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>`;

// Wait, I need to find where uidNamespaceInput is in the file.
// It's around line 910+
content = content.replace(uidNamespaceInput, uidNamespaceInput + subjectsUI);

// 9. Add subject dropdown to source modal
// Find the source type select and add subject dropdown below it.
const sourceIdInput = `<div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="source-id">
                      ID (unique slug)
                    </label>
                    <Input
                      id="source-id"
                      value={sourceId}
                      onChange={(e) => setSourceId(e.target.value)}
                      placeholder="e.g. main-repo"
                      disabled={sourceSaving}
                    />
                  </div>`;

const subjectSelectUI = `
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="source-subject">
                      Subject association (optional)
                    </label>
                    <Select
                      id="source-subject"
                      value={sourceSubjectId}
                      onChange={(e) => setSourceSubjectId(e.target.value)}
                      disabled={sourceSaving}
                    >
                      <option value="">Default (discrete-math)</option>
                      {config?.subjects?.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.title} ({sub.id})
                        </option>
                      ))}
                    </Select>
                  </div>`;

content = content.replace(sourceIdInput, sourceIdInput + subjectSelectUI);

// 10. Add Subject Modal UI
const subjectModalUI = `
        {/* Subject modal */}
        {subjectModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={closeSubjectModal} />
            <Card className="relative w-full max-w-lg space-y-4" padding="md">
              <div>
                <h3 className="text-lg font-semibold text-text">{subjectEditingIndex === null ? "Add Subject" : "Edit Subject"}</h3>
                <p className="text-sm text-textMuted">Define a subject to associate with sources.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="sub-id">
                  ID (slug)
                </label>
                <Input
                  id="sub-id"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  placeholder="e.g. discrete-math"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="sub-title">
                  Title
                </label>
                <Input
                  id="sub-title"
                  value={subjectTitle}
                  onChange={(e) => setSubjectTitle(e.target.value)}
                  placeholder="e.g. Discrete Mathematics"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeSubjectModal}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" onClick={saveSubjectDraft}>
                  {subjectEditingIndex === null ? "Add" : "Update"}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
`;

// Insert before closing PageShell/AdminAuthGate
content = content.replace('      </PageShell>\n    </AdminAuthGate>', subjectModalUI + '      </PageShell>\n    </AdminAuthGate>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched SourcesManagerPage.tsx');
