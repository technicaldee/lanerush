import he from "he";
import type { Question } from "@/lib/types";

export type OpenTdbApiResult = {
  response_code: number;
  results: {
    type: string;
    difficulty: string;
    category: string;
    question: string;
    correct_answer: string;
    incorrect_answers: string[];
  }[];
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mapOpenTdbToQuestions(results: OpenTdbApiResult["results"]): Question[] {
  return results.map((r) => {
    const correct = he.decode(r.correct_answer);
    const wrong = r.incorrect_answers.map((w) => he.decode(w));
    const options = shuffleInPlace([correct, ...wrong]);
    const correctIndex = options.indexOf(correct);
    return {
      question: he.decode(r.question),
      options,
      correctIndex,
    };
  });
}
