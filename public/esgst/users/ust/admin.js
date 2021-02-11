const mainContainerEl = document.querySelector('#main-container');
let ticketContainerEl = null;
let buttonContainerEl = null;
let currentTicket = null;

fetch('/esgst/me').then(async (response) => {
	const user = await response.json();
	if (user) {
		if (user.role > 2) {
			renderUnauthorized();
		} else {
			renderLoggedIn();
		}
	} else {
		renderLoggedOut();
	}
});

function renderUnauthorized() {
	mainContainerEl.textContent = 'You are unauthorized to do this.';
}

function renderLoggedIn() {
	document.body.insertAdjacentHTML(
		'afterbegin',
		`
			<header>
				<nav>
					<div class="nav__left-container"></div>
					<div class="nav__right-container">
						<div class="nav__button-container">
							<a class="nav__button" href="/esgst/logout?origin=/esgst/users/ust/admin.html">Logout</a>
						</div>
					</div>
				</nav>
			</header>
		`
	);
	mainContainerEl.insertAdjacentHTML(
		'beforeend',
		`
			<div id="ticket-container"></div>
			<div class="align-button-container is-hidden" id="button-container">
				<a class="comment__submit-button" id="not-activated">Not Activated</a>
				<a class="comment__submit-button" id="multiple">Multiple</a>
				<a class="comment__submit-button" id="not-activated-multiple">Not Activated + Multiple</a>
				<a class="comment__submit-button" id="skip">Skip</a>
			</div>
		`
	);
	ticketContainerEl = mainContainerEl.querySelector('#ticket-container');
	buttonContainerEl = mainContainerEl.querySelector('#button-container');
	mainContainerEl.querySelector('#not-activated').addEventListener('click', sendNotActivated);
	mainContainerEl.querySelector('#multiple').addEventListener('click', sendMultiple);
	mainContainerEl
		.querySelector('#not-activated-multiple')
		.addEventListener('click', sendNotActivatedMultiple);
	mainContainerEl.querySelector('#skip').addEventListener('click', skip);
	getTicket();
}

function renderLoggedOut() {
	mainContainerEl.insertAdjacentHTML(
		'beforeend',
		`
			<a href="/esgst/login?origin=/esgst/users/ust/admin.html">
				<img src="https://community.cloudflare.steamstatic.com/public/images/signinthroughsteam/sits_01.png"/>
			</a>
		`
	);
}

async function getTicket() {
	ticketContainerEl.innerHTML = '';
	try {
		const response = await fetch('/esgst/users/ust/ticket');
		if (response.status === 401) {
			currentTicket = null;
			ticketContainerEl.textContent = 'You are unauthorized to do this.';
			buttonContainerEl.classList.add('is-hidden');
			return;
		}
		const json = await response.json();
		if (!json) {
			currentTicket = null;
			ticketContainerEl.textContent = 'There are no more tickets.';
			buttonContainerEl.classList.add('is-hidden');
			return;
		}
		currentTicket = json.result;
		if (!currentTicket.steamId) {
			currentTicket = null;
			ticketContainerEl.textContent =
				'Could not find the user for the ticket. Retrieving another ticket.';
			buttonContainerEl.classList.add('is-hidden');
			window.setTimeout(getTicket, 1000);
			return;
		}
		ticketContainerEl.innerHTML = currentTicket.ticket;
		currentTicket.timestamp = parseInt(
			ticketContainerEl
				.querySelector('.notification [data-timestamp]')
				.getAttribute('data-timestamp')
		);
		buttonContainerEl.classList.remove('is-hidden');
	} catch (err) {
		currentTicket = null;
		ticketContainerEl.textContent = 'Failed to retrieve the ticket.';
		buttonContainerEl.classList.add('is-hidden');
	}
}

async function sendNotActivated() {
	await fetch('/esgst/users/ust/ticket', {
		body: JSON.stringify({
			ticketId: currentTicket.ticketId,
			steamId: currentTicket.steamId,
			status: 'added',
			notActivated: currentTicket.timestamp,
		}),
		headers: {
			'Content-Type': 'application/json',
		},
		method: 'POST',
	});
	window.setTimeout(getTicket, 500);
}

async function sendMultiple() {
	await fetch('/esgst/users/ust/ticket', {
		body: JSON.stringify({
			ticketId: currentTicket.ticketId,
			steamId: currentTicket.steamId,
			status: 'added',
			multiple: currentTicket.timestamp,
		}),
		headers: {
			'Content-Type': 'application/json',
		},
		method: 'POST',
	});
	window.setTimeout(getTicket, 500);
}

async function sendNotActivatedMultiple() {
	await fetch('/esgst/users/ust/ticket', {
		body: JSON.stringify({
			ticketId: currentTicket.ticketId,
			steamId: currentTicket.steamId,
			status: 'added',
			notActivated: currentTicket.timestamp,
			multiple: currentTicket.timestamp,
		}),
		headers: {
			'Content-Type': 'application/json',
		},
		method: 'POST',
	});
	window.setTimeout(getTicket, 500);
}

async function skip() {
	await fetch('/esgst/users/ust/ticket', {
		body: JSON.stringify({
			ticketId: currentTicket.ticketId,
			steamId: currentTicket.steamId,
			status: 'skipped',
		}),
		headers: {
			'Content-Type': 'application/json',
		},
		method: 'POST',
	});
	window.setTimeout(getTicket, 500);
}
