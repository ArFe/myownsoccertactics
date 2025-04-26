import { PlayerPosition } from '../components/SoccerField';

// Field dimensions are relative to the actual field image
// The field has 5% margin on all sides, so we'll use 90% of the width/height
const MARGIN = 0.05; // 5% margin
const USABLE_WIDTH = 1 - 2 * MARGIN; // 90% of width
const USABLE_HEIGHT = 1 - 2 * MARGIN; // 90% of height

// Helper function to convert relative positions to absolute coordinates
// x and y are percentages of the usable field area (-0.5 to 0.5)
const getPosition = (x: number, y: number): PlayerPosition => ({
  x: x,
  y: y
});

// 4-4-2 formation positions (relative to field center)
export const default442Positions = {
  homeTeam: [
    // Goalkeeper (1) - Far left, center
    getPosition(-0.4, 0),
    // Defenders (back 4)
    getPosition(-0.3, -0.2), // Left back (2)
    getPosition(-0.3, -0.1), // Left center back (3)
    getPosition(-0.3, 0.1),  // Right center back (4)
    getPosition(-0.3, 0.2),  // Right back (5)
    // Midfielders (4)
    getPosition(-0.15, -0.2), // Left midfield (6)
    getPosition(-0.15, -0.1), // Left center midfield (7)
    getPosition(-0.15, 0.1),  // Right center midfield (8)
    getPosition(-0.15, 0.2),  // Right midfield (9)
    // Forwards (2)
    getPosition(-0.05, -0.1), // Left forward (10)
    getPosition(-0.05, 0.1)   // Right forward (11)
  ],
  awayTeam: [
    // Goalkeeper (1) - Far right, center
    getPosition(0.4, 0),
    // Defenders (back 4)
    getPosition(0.3, -0.2), // Left back (2)
    getPosition(0.3, -0.1), // Left center back (3)
    getPosition(0.3, 0.1),  // Right center back (4)
    getPosition(0.3, 0.2),  // Right back (5)
    // Midfielders (4)
    getPosition(0.15, -0.2), // Left midfield (6)
    getPosition(0.15, -0.1), // Left center midfield (7)
    getPosition(0.15, 0.1),  // Right center midfield (8)
    getPosition(0.15, 0.2),  // Right midfield (9)
    // Forwards (2)
    getPosition(0.05, -0.1), // Left forward (10)
    getPosition(0.05, 0.1)   // Right forward (11)
  ],
  ball: getPosition(0, 0) // Center of the field
}; 
