const canvas = document.getElementById('c')
const c = canvas.getContext('2d')

// One gridline every 50 pixels
const gridlineSpacing = 50
const gridlineThickness = 2
const chargeRadius = 10

function drawGridlines() {
	c.fillStyle = 'black'
	for (let i = 0; i < canvas.width; i+=gridlineSpacing) {
		c.fillRect(i, 0, gridlineThickness, canvas.height)
	}

	for (let i = 0; i < canvas.height; i+=gridlineSpacing) {
		c.fillRect(0, i, canvas.width, gridlineThickness)
	}
}

let charges = []

/*
 * Finds the nearest gridline value.
 * For example, if gridlineSpacing were 50
 * and position were 173, then the function
 * would return 200, because 200 is the closest
 * multiple of 50.
 */
function findNearestGridlineValue(position) {
	if ((position % gridlineSpacing) > gridlineSpacing / 2) {
		return position - (position % gridlineSpacing) + gridlineSpacing
	} else {
		return position - (position % gridlineSpacing)
	}
}

const abortThreshold = 10
let ds = 1
/*
 * Return a vector with a magnitude ds (small increment)
 * that points in the direction of the force on a small
 * positive test charge. For more information, see
 * https://en.wikipedia.org/wiki/Field_line#Construction
 */
function findFieldVector(x, y, checkAbort) {
	let abort = false
	// x and y component of the vector
	let xComponent = 0
	let yComponent = 0
	// Magnitude of charge of test charge
	const q1 = 0.01
	for (let i = 0; i < charges.length; i++) {
		const q2 = charges[i].charge
		// Charges with no magnitude do not affect the force on the test charge
		if (q2 === 0) {
			continue
		}
		// Distance between test charge and current charge
		const deltaX = x - charges[i].x
		const deltaY = y - charges[i].y
		const r = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
		// Abort if we have already reached the "final position" for performance
		if (r < abortThreshold && checkAbort) {
			abort = true
			break
		}
		const magnitude = q1 * q2 / (r * r)
		// These calculations come from the fact that the
		// vector forms a similar triangle with the triangle
		// connecting the two charges
		xComponent += magnitude * deltaX / r
		yComponent += magnitude * deltaY / r
	}
	// Make the magnitude of the returned vector equal ds
	const magnitude = Math.sqrt(xComponent * xComponent + yComponent * yComponent)
	xComponent = xComponent * ds / magnitude
	yComponent = yComponent * ds / magnitude
	return {xComponent, yComponent, abort}
}

// The length of the tips of the arrows
const arrowLength = 20
function renderArrows(arrows) {
	c.lineWidth = 2
	for (let i = 0; i < arrows.length; i++) {
		let {xPos, yPos, xComponent, yComponent} = arrows[i]
		// Reverse signs so that arrows point away from positive charges (instead of towards them)
		const theta = Math.atan2(-yComponent, -xComponent)
		c.beginPath()
		c.moveTo(xPos, yPos)
		c.lineTo(xPos + arrowLength * Math.cos(theta + Math.PI / 4), yPos + arrowLength * Math.sin(theta + Math.PI / 4))
		c.stroke()
		c.beginPath()
		c.moveTo(xPos, yPos)
		c.lineTo(xPos + arrowLength * Math.cos(theta - Math.PI / 4), yPos + arrowLength * Math.sin(theta - Math.PI / 4))
		c.stroke()
	}
}

// How often should there be an arrow on the field line?
let arrowIncrement = 200
let maxIterationsPerFieldLine = 10000
function renderFieldLine(startingX, startingY) {
	let xPos = startingX
	let yPos = startingY
	const arrows = []
	c.lineWidth = 3
	c.beginPath()
	for (let i = 0; i < maxIterationsPerFieldLine; i++) {
		const deltaXFromStart = startingX - xPos
		const deltaYFromStart = startingY - yPos
		const distanceFromStart = Math.sqrt(deltaXFromStart * deltaXFromStart + deltaYFromStart * deltaYFromStart)
		const {xComponent, yComponent, abort} = findFieldVector(xPos, yPos, distanceFromStart > abortThreshold)
		if (abort) {
			break
		}
		c.lineTo(xPos, yPos)
		xPos += xComponent
		yPos += yComponent
		c.lineTo(xPos, yPos)

		if (i !== 0 && i % arrowIncrement === 0) {
			arrows.push({xPos, yPos, xComponent, yComponent})
		}
	}
	c.stroke()
	renderArrows(arrows)
}

// Number of field lines per charge
const numFieldLinesPerCharge = 6
function renderCharges() {
	c.clearRect(0, 0, canvas.width, canvas.height)
	drawGridlines()
	if (charges.length > 0) {
		for (let i = 0; i < charges.length; i++) {
			if (charges[i].charge <= 0) {
				continue
			}
			const numFieldLines = charges[i].charge * numFieldLinesPerCharge
			const angleIncrement = Math.PI * 2 / numFieldLines
			for (let j = 0; j < numFieldLines; j++) {
				renderFieldLine(charges[i].x + Math.cos(j * angleIncrement), charges[i].y + Math.sin(j * angleIncrement))
			}
		}
	}
	for (let i = 0; i < charges.length; i++) {
		c.beginPath()
		c.arc(charges[i].x, charges[i].y, 10, 0, 2 * Math.PI)
		if (charges[i].charge === 0) {
			c.fillStyle = 'gray'
		} else if (charges[i].charge > 0) {
			c.fillStyle = 'red'
		} else {
			c.fillStyle = 'blue'
		}
		c.fill()
		// Highlight the charge being edited
		if (i === currentChargeEditing) {
			c.lineWidth = 2
			c.stroke()
		}
	}
}

// The index of the charge whose properties are currently being edited
let currentChargeEditing = 0

// Returns the index of the charge with the given coordinates, -1 if there is none
function indexOfChargeAt(x, y) {
	for (let i = 0; i < charges.length; i++) {
		if (charges[i].x === x && charges[i].y === y) {
			return i
		}
	}
	return -1
}

function onCanvasClick(event) {
	// Find the nearest grid intersection and center the coordinate on the gridline
	const x = findNearestGridlineValue(event.clientX) + gridlineThickness / 2
	const y = findNearestGridlineValue(event.clientY) + gridlineThickness / 2

	if (event.buttons === 1) {
		// Do not create charges with the same coordinates
		if (indexOfChargeAt(x, y) !== -1) {
			return
		}
		charges.push({x, y, charge: 1})
		currentChargeEditing = charges.length - 1
		updateEditingDiv()
		renderCharges()
	} else {
		const i = indexOfChargeAt(x, y)
		if (i !== -1) {
			currentChargeEditing = i
			updateEditingDiv()
			renderCharges()
		}
	}
}

const chargeInput = document.getElementById('chargeInput')
const arrowFrequencyInput = document.getElementById('arrowFrequencyInput')
const dsInput = document.getElementById('dsInput')
const maxIterationsInput = document.getElementById('maxIterationsInput')
const saveButton = document.getElementById('saveButton')

function updateEditingDiv() {
	chargeInput.value = charges[currentChargeEditing].charge
}

arrowFrequencyInput.value = arrowIncrement
dsInput.value = ds
maxIterationsInput.value = maxIterationsPerFieldLine

saveButton.onclick = function() {
	const newCharge = parseInt(chargeInput.value)
	if (isNaN(newCharge)) {
		charges[currentChargeEditing].charge = 0
		chargeInput.value = '0'
	} else {
		charges[currentChargeEditing].charge = parseInt(chargeInput.value)
	}

	const newArrowFrequency = parseInt(arrowFrequencyInput.value)
	if (isNaN(newArrowFrequency)) {
		arrowFrequencyInput.value = arrowIncrement
	} else {
		arrowIncrement = newArrowFrequency
	}

	const newDs = parseInt(dsInput.value)
	if (isNaN(newDs)) {
		dsInput.value = ds
	} else {
		ds = newDs
	}

	const newMaxIterations = parseInt(maxIterationsInput.value)
	if (isNaN(newMaxIterations)) {
		maxIterationsInput.value = maxIterationsPerFieldLine
	} else {
		maxIterationsPerFieldLine = newMaxIterations
	}

	renderCharges()
}

canvas.onmousedown = onCanvasClick

function sizeCanvas() {
	canvas.width = window.innerWidth * 0.8
	canvas.height = window.innerHeight
	drawGridlines()
	renderCharges()
}

function preset(newCharges, newArrowIncrement, newDs, newMaxIterations) {
	charges = newCharges
	currentChargeEditing = charges.length - 1

	arrowIncrement = newArrowIncrement
	arrowFrequencyInput.value = arrowIncrement

	ds = newDs
	dsInput.value = ds

	maxIterationsPerFieldLine = newMaxIterations
	maxIterationsInput.value = maxIterationsPerFieldLine

	renderCharges()
}

document.getElementById('presetPointCharge').onclick = () => preset([{"x":351,"y":301,"charge":1}], 200, 1, 10000)
document.getElementById('presetLines').onclick = () => preset([{"x":201,"y":301,"charge":1},{"x":251,"y":301,"charge":1},{"x":301,"y":301,"charge":1},{"x":351,"y":301,"charge":1},{"x":401,"y":301,"charge":1},{"x":451,"y":301,"charge":1},{"x":501,"y":301,"charge":1},{"x":551,"y":301,"charge":1},{"x":601,"y":301,"charge":1},{"x":651,"y":301,"charge":1},{"x":701,"y":301,"charge":1},{"x":751,"y":301,"charge":1},{"x":801,"y":301,"charge":1},{"x":851,"y":301,"charge":1},{"x":201,"y":401,"charge":-1},{"x":251,"y":401,"charge":-1},{"x":301,"y":401,"charge":-1},{"x":351,"y":401,"charge":-1},{"x":401,"y":401,"charge":-1},{"x":451,"y":401,"charge":-1},{"x":501,"y":401,"charge":-1},{"x":551,"y":401,"charge":-1},{"x":601,"y":401,"charge":-1},{"x":651,"y":401,"charge":-1},{"x":701,"y":401,"charge":-1},{"x":751,"y":401,"charge":-1},{"x":801,"y":401,"charge":-1},{"x":851,"y":401,"charge":-1}], 100, 1, 10000000)
document.getElementById('presetEqualMagnitudeOppositeSign').onclick = () => preset([{"x":151,"y":301,"charge":1},{"x":551,"y":301,"charge":-1}], 200, 1, 10000)
document.getElementById('presetEqualMagnitudeSameSign').onclick = () => preset([{"x":151,"y":301,"charge":1},{"x":551,"y":301,"charge":1}], 200, 1, 10000)

window.onresize = sizeCanvas
sizeCanvas()
