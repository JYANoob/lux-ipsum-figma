
figma.showUI(__html__, {
  width: 360,
  height: 650,
  themeColors: true
});

function sendSelection() {
  const selection = figma.currentPage.selection;
  const textNodes = selection.filter(node => node.type === "TEXT");

  figma.ui.postMessage({
    type: "selection",
    selectedCount: selection.length,
    textCount: textNodes.length,
    names: textNodes.slice(0, 5).map(node => node.name)
  });
}

figma.on("selectionchange", sendSelection);
sendSelection();

figma.ui.onmessage = async (message) => {
  if (message.type === "generate") {
    try {
      const texts = Array.isArray(message.texts) ? message.texts : [];
      const selectedTextNodes = figma.currentPage.selection.filter(
        node => node.type === "TEXT"
      );

      if (!texts.length || !texts.some(text => typeof text === "string" && text.length)) {
        figma.ui.postMessage({
          type: "status",
          message: "Generate some text first."
        });
        return;
      }

      if (selectedTextNodes.length > 0) {
        let updated = 0;

        for (let i = 0; i < selectedTextNodes.length; i++) {
          const node = selectedTextNodes[i];
          const newText = texts[i % texts.length];

          if (typeof newText !== "string") continue;

          // Load the existing fonts before editing the text.
          const originalLength = node.characters.length;

          if (originalLength > 0) {
            const fonts = node.getRangeAllFontNames(0, originalLength);
            await Promise.all(
              fonts.map(font => figma.loadFontAsync(font))
            );
          } else if (node.fontName !== figma.mixed) {
            await figma.loadFontAsync(node.fontName);
          }

          // Keep the existing text node and its surrounding layout.
          // Figma may retain existing character styling where applicable.
          node.characters = newText;
          updated++;
        }

        figma.ui.postMessage({
          type: "status",
          message: `Updated ${updated} text layer${updated === 1 ? "" : "s"}.`
        });
      } else {
        const newText = texts[0];
        const font = { family: "Inter", style: "Regular" };

        await figma.loadFontAsync(font);

        const node = figma.createText();
        node.fontName = font;
        node.fontSize = 16;
        node.characters = newText;
        node.fills = [{
          type: "SOLID",
          color: { r: 0.12, g: 0.12, b: 0.15 }
        }];

        const center = figma.viewport.center;
        node.x = center.x;
        node.y = center.y;

        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);

        figma.ui.postMessage({
          type: "status",
          message: "Created a new text layer."
        });
      }

      sendSelection();
    } catch (error) {
      figma.ui.postMessage({
        type: "status",
        message: "Couldn't edit the text. Try another selection or font."
      });
      console.error(error);
    }
  }

  if (message.type === "cancel") {
    figma.closePlugin();
  }
};
