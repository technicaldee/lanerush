import questionBank from "@/data/questions.json";
import type { Question } from "@/lib/types";

type QuestionBank = {
  questions: Question[];
};

export const questions = (questionBank as QuestionBank).questions;
