import { GraphicalStyle, GraphicalStyleLabels, getGraphicalStyleLabel } from './story-enums';

describe('GraphicalStyle', () => {
  it.each([
    [GraphicalStyle.CLAYMATION, 'Claymation'],
    [GraphicalStyle.PAPERCUT, 'PaperCut'],
  ])('exposes %s with its canonical label', (style, label) => {
    expect(GraphicalStyleLabels[style]).toBe(label);
    expect(getGraphicalStyleLabel(style)).toBe(label);
  });
});
