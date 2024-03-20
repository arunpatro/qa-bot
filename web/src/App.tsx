import type { Component } from 'solid-js';

import { createSignal, Show, createEffect } from 'solid-js';
import { demo1 } from './demo-data';
import styles from './App.module.css';
import uploadIconUrl from '@assets/upload-icon.svg';
import xIconUrl from '@assets/x-icon.svg';
import Spinner from './Spinner';

const MAX_FILE_MB = 20;
const MAX_FILE_SIZE = MAX_FILE_MB * 1024 * 1024;

interface PdfData {
  total_pages: number;
  processed_pages: number;
  text: string;
  max_tokens: number;
  total_tokens: number;
}
interface QuizItem {
  question: string;
  options: [{ id: number; text: string }];
  correct_option: number;
}

// file upload state
const [file, setFile] = createSignal<File | null>(null);
const [fileTooLarge, setFileTooLarge] = createSignal(false);
// pdf processing state
const [pdfData, setPdfData] = createSignal<PdfData | null>(null);
const [pdfProcessing, setPdfProcessing] = createSignal(false);
// demo state
const [viewDemo, setViewDemo] = createSignal(false);
// quiz data state
const [quizData, setQuizData] = createSignal<[QuizItem] | null>(null);
const [quizProcessing, setQuizProcessing] = createSignal(false);
const [quizError, setQuizError] = createSignal(false);

const App: Component = () => {
  let fileInput!: HTMLInputElement;
  createEffect(() => {
    const f = file();
    if (f !== null) {
      if (f!.size > MAX_FILE_SIZE) {
        setFileTooLarge(true);
        setFile(null);
      } else {
        setFileTooLarge(false);
      }
      setViewDemo(false);
      // reset quiz state upon file upload
      setQuizData(null);
      setQuizError(false);
    }
  });
  // process pdf (extract text) if file uploaded
  createEffect(() => {
    const f = file();
    if (f !== null && f!.size <= MAX_FILE_SIZE) {
      setPdfData(null);
      setPdfProcessing(true);
      processPdfHandler(f)
        .then((data) => setPdfData(data))
        .then(() => setPdfProcessing(false))
        .catch(() => setPdfProcessing(false));
    }
  });
  // reset file & pdf state if viewing demo quiz
  createEffect(() => {
    if (viewDemo()) {
      setFile(null);
      setFileTooLarge(false);
      setPdfData(null);
    }
  });

  return (
    <>
      <h1>Live Quiz Generator</h1>
      <p>
        This interactive tool allows you to generate quizzes from PDF documents. Support for other
        data formats (images, videos, web links) will come in the future.
      </p>
      <p>Try a demo quiz to see how it works, or upload a file to generate your own.</p>
      <div class={styles.demoOptions}>
        <button
          class={styles.tryDemo}
          onClick={() => {
            setViewDemo(true);
            setQuizData(demo1 as [QuizItem]);
          }}
        >
          Try demo quiz
        </button>
        <span class={styles.optionsDivider}>or</span>
        <section class={styles.fileUploadDiv}>
          <h6>Choose a PDF file</h6>
          <label
            id="file-upload-box"
            for="file-upload"
            class={styles.fileUpload}
            onDrop={dropHandler}
            onDragOver={dragOverHandler}
          >
            <input
              ref={fileInput}
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={uploadHandler}
            ></input>
            <img class={styles.fileUploadIcon} src={uploadIconUrl} width={40} />
            <div>
              <p class={styles.fileDropText}>Drag and drop file here</p>
              <span class={styles.fileSizeLimit}>
                Limit {`${MAX_FILE_MB}MB`} per file &bull; PDF
              </span>
            </div>
            <button onClick={() => fileInput.click()}>Browse files</button>
          </label>
          <Show when={file() !== null}>
            <div class={styles.fileInfo}>
              {file()!.name}{' '}
              <span class={styles.fileSizeLimit}>
                {(file()!.size / 1e6).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
                MB
              </span>
              <img class={styles.xIcon} src={xIconUrl} />
            </div>
          </Show>
        </section>
      </div>
      <Show when={fileTooLarge()}>
        <div class={styles.errorMessage}>
          Max file size limit exceeded. Please select a smaller file.
        </div>
      </Show>
      <Show when={pdfProcessing()}>
        <div class={styles.loadingMessage}>
          <Spinner />
          Extracting text from PDF...
        </div>
      </Show>
      <Show when={pdfData() != null && quizData() == null}>
        <Show when={pdfData()!.total_tokens > pdfData()!.max_tokens}>
          <div class={styles.warningMessage}>
            Text is too long ({pdfData()!.total_tokens} tokens). Truncating to{' '}
            {pdfData()!.max_tokens} tokens.
          </div>
        </Show>
        <p class={`${styles.pdfSuccess}${quizProcessing() ? ` ${styles.disabled}` : ''}`}>
          PDF text successfully parsed. Pages considered:{' '}
          {`${pdfData()!.processed_pages}/${pdfData()!.total_pages}`}.
        </p>
        <button
          class={styles.quizControlButton}
          onClick={() => {
            setQuizProcessing(true);
            setQuizError(false);
            generateQuizHandler(pdfData()!.text)
              .then((data) => setQuizData(data))
              .then(() => setQuizProcessing(false))
              .catch(() => setQuizProcessing(false));
          }}
          disabled={quizProcessing()}
        >
          Generate questions
        </button>
        <Show when={quizProcessing()}>
          <div class={styles.loadingMessage}>
            <Spinner />
            Generating...
          </div>
        </Show>
        <Show when={quizError()}>
          <div class={styles.errorMessage}>
            Sorry but the quiz cannot be generated right now. Please try again later or{' '}
            <a href="emailto:quizgen@robertshin.com">contact us</a> for support.
          </div>
        </Show>
      </Show>
      <Show when={quizData() != null}>
        {quizData()!.map((q, idx) => (
          <fieldset class={styles.mcFieldset}>
            <label class={styles.mcQuestion}>{q.question}</label>
            {q.options.map((opt) => (
              <div class={styles.mcOption}>
                <input
                  type="radio"
                  id={`q${idx}_${opt.id}`}
                  value={opt.text}
                  name={idx.toString()}
                />
                <label for={`q${idx}_${opt.id}`}>{opt.text}</label>
              </div>
            ))}
          </fieldset>
        ))}
      </Show>
    </>
  );
};

async function processPdfHandler(f: File) {
  const formData = new FormData();
  formData.append('pdf', f);

  try {
    const response = await fetch('/api/processPdf', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}

async function generateQuizHandler(passage: string) {
  const formData = new FormData();
  formData.append('passage', passage);

  try {
    const response = await fetch('/api/generateQuiz', {
      method: 'POST',
      body: formData,
    });
    const result = await response.json();
    return result;
  } catch (error) {
    setQuizError(true);
  }
}

function uploadHandler(ev: Event) {
  const file = (ev.target as HTMLInputElement).files![0];
  setFile(file);
}

function dropHandler(ev: DragEvent) {
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();

  if (ev.dataTransfer!.items) {
    // Use DataTransferItemList interface to access the file
    const item = ev.dataTransfer!.items[0];
    // If dropped item isn't a file, reject it
    if (item.kind === 'file') {
      const file = item.getAsFile();
      setFile(file);
    }
  } else {
    // Use DataTransfer interface to access the file
    const file = ev.dataTransfer!.files[0];
    setFile(file);
  }
}
function dragOverHandler(ev: DragEvent) {
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
  ev.dataTransfer!.dropEffect = 'copy';
}

export default App;
