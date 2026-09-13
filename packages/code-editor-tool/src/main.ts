import './style.css';

async function main(): Promise<void> {
    const boot = document.querySelector<HTMLElement>('#boot');
    const workbench = document.querySelector<HTMLElement>('#workbench');
    if (!boot || !workbench) throw new Error('Code Editor host elements are missing');

    try {
        // CodinGame measures this element while constructing the workbench. It must
        // participate in layout before initialize() runs or VS Code is permanently
        // laid out at 0 x 0, even if `hidden` is removed afterwards.
        workbench.hidden = false;
        const { startCodeEditor } = await import('./workbench');
        await startCodeEditor(workbench, (message) => {
            const label = document.querySelector<HTMLElement>('#boot-message');
            if (label) label.textContent = message;
        });
        boot.remove();
    } catch (error) {
        console.error(error);
        workbench.hidden = true;
        boot.dataset.state = 'error';
        boot.textContent = error instanceof Error ? error.message : 'Code Editor could not start';
    }
}

void main();
