function readXYZString(s: string) {
    let sys = new System(sysCount, elements.getNextId());

    let lines = s.split(/[\n]+/g);

    sys.initInstances(lines.length);
    systems.push(sys);
    sysCount++;

    lines.forEach((l, i) => {
        let str = sys.addNewGenericSphereStrand();
        let e = str.createBasicElement(i);
        e.sid = i;
        let split_line = l.split(' ');;
        e.calcPositionsFromConfLine(split_line);
        e.type = 'A';
        elements.push(e);
    });

    addSystemToScene(sys);

}