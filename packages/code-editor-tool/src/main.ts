import './style.css';

async function main(): Promise<void> {
    const boot = document.querySelector<HTMLElement>('#boot');
    const workbench = document.querySelector<HTMLElement>('#workbench');
    if (!boot || !workbench) throw new Error('Code Editor host elements are missing');

    try {
        const { startCodeEditor } = await import('./workbench');
        await startCodeEditor(workbench, (message) => {
            const label = document.querySelector<HTMLElement>('#boot-message');
            if (label) label.textContent = message;
        });
        workbench.hidden = false;
        boot.remove();
    } catch (error) {
        console.error(error);
        boot.dataset.state = 'error';
        boot.textContent = error instanceof Error ? error.message : 'Code Editor could not start';
    }
}

void main();
