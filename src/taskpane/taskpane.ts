/* global Word console */

export async function insertText(text: string) {
  // Write text to the document.
  try {
    await Word.run(async (context) => {
      let body = context.document.body;
      body.insertParagraph(text, Word.InsertLocation.end);
      await context.sync();
    });
  } catch (error) {
    console.log("Error: " + error);
  }
}
export async function getSelectedText(): Promise<string> {
  return Word.run(async (context) => {
    const range = context.document.getSelection();
    range.load("text");

    await context.sync();

    return range.text || "";
  });
}

export async function insertTextAfterSelection(text: string): Promise<void> {
  await Word.run(async (context) => {
    const range = context.document.getSelection();
    range.insertText("\n\n--- Word Assistant ---\n" + text, Word.InsertLocation.after);
    await context.sync();
  });
}
