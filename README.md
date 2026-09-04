<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />

# Mukkal-Mania 🎯


## Basic Details
### Team Name: Caffeine Warriors


### Team Members
- Member 1: Mohammed Zain - Model Engineering College
- Member 3: Gayathri Vimaldev - Model Engineering College

### Project Description
Mukkal-Mania is a retro 16-bit arcade ragebait game about the age-old Malayalee ritual of dipping a biscuit into chaya (tea) — except the odds are rigged against you. Hold your nerve, dip at the right moment, and try to beat a biscuit that wants to fall apart.

### The Problem (that doesn't exist)
Every day, millions of people dip a biscuit into their tea and just... eat it. No stakes. No tension. No 90% chance of soul-crushing failure. This is clearly a gap in the human experience.

### The Solution (that nobody asked for)
We turned biscuit-dipping into a rigged arcade game. Move the hand up and down to lower your biscuit toward the cup, and hope the RNG gods are feeling generous — because 9 times out of 10, your biscuit crumbles into the tea whether or not it's even touched the surface yet.

## Technical Details
### Technologies/Components Used
For Software:
-Languages: JavaScript (ES6), HTML5
-Frameworks: None — Vanilla JS only
-Libraries: None — zero external dependencies
-Tools: LibreSprite (all frontend art, animation, and UI assets), HTML5 Canvas (rendering)

### Implementation
For Software:
git clone 
cd mukkal-mania

# Run
No build step or dependencies required — it's plain HTML/JS/Canvas.
Just open index.html in a browser, or serve it locally:
--python3 -m http.server 8000
then visit http://localhost:8000

### Project Documentation
For Software: https://github.com/vimaldevgayathri-cell/Mukkal-Mania.git

# Screenshots (Add at least 3)
https://drive.google.com/file/d/1zkM0ZWz7UqLOokm_K_fwmlkivDjobjJu/view?usp=sharing
The main menu, rendered entirely from a single LibreSprite background — the Malayalee tea stall, title art, and PLAY / CHOOSE YOUR WEAPON buttons are all baked into one sprite, with button labels overlaid on canvas.

https://drive.google.com/file/d/1q3fDbHn4b_BRJgaIYh-vjsWnSTxQmMaL/view?usp=sharing
Core gameplay loop — the hand (with the biscuit anchored to it) moves up and down toward the cup using the arrow keys, while the crumble outcome is decided behind the scenes.


https://drive.google.com/file/d/1GfEZnQ2DGZHtek2iWbc_SunxJyXV3zvl/view?usp=sharing
The win state — the biscuit sprite swaps to its "soggy" (successfully dipped) variant, and the player is given the option to play again or quit.

# Diagrams
ARCHITECTURE
https://drive.google.com/file/d/1QVjCtkbe4JrVF_Ig-BiWbpzvIjFw6qkk/view?usp=sharing
The engine reads/writes a single shared state object every frame, pulls in LibreSprite-exported sprites for rendering, and takes keyboard input to drive the hand's movement — no external UI framework involved.

GAMEPLAY WORKFLOW
https://drive.google.com/file/d/1pW78mEfb8wnsrGirpRJlXfTskkfBFLXo/view?usp=sharing
Each round's fate (crack vs. win) is decided the moment PLAY is pressed, then fires at a random moment during the round — independent of whether the biscuit has actually touched the tea.

### Project Demo
# Video
https://drive.google.com/file/d/12OPmMAZO6_94452ImhW6JkP8TF6YEmLV/view?usp=sharing
Demonstrates the full loop: intro animation → menu → gameplay dip mechanic → win/crumble outcomes.


## Team Contributions
-Mohammed Zain: Frontend and Design — all LibreSprite artwork, sprite animation, and UI/visual design for the game.
-Gayathri Vimaldev: Backend — game engine logic, state management, RNG/crumble mechanics, and canvas rendering pipeline.

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)



