import BSTree from "typescript-collections/dist/lib/BSTree";
import { listenerCount } from "cluster";
import { prepareProfile } from "selenium-webdriver/firefox";
import { startTimeRange } from '@angular/core/src/profile/wtf_impl';
import { disableDebugTools } from '@angular/platform-browser/src/browser/tools/tools';

export class Point {
    static id_holder = 0;
    x: number;
    y: number;
    id: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.id = ++Point.id_holder;
    }

    public whoHasHighPriority(point: Point): Point {
        let highYValuePoint = this.y - point.y;
        if (highYValuePoint > 0) {
            return this;
        } else if (highYValuePoint < 0) {
            return point;
        } else {

        }
    }
}

export class Site {
    siteId: number;
    constructor(public point: Point) {
        this.siteId = point.id;
    }
}

export class Edge {
    vertexA: Point;
    vertexB: Point;
    leftSite: Site;
    rightSite: Site;

    constructor(lSite: Site, rSite: Site) {
        this.leftSite = lSite;
        this.rightSite = rSite;
    }
}

export class HalfEdge {
    leftSite: Site;
    rightSite: Site;
    edge: Edge;
    twin: HalfEdge;
    previousHalfEdge: HalfEdge;
    nextHalfEdge: HalfEdge;
    constructor(_lSite: Site, _rSite: Site) {
        this.leftSite = _lSite;
        if (_rSite && _lSite.siteId != _rSite.siteId) {
            this.rightSite = _rSite;
        } else {
            this.rightSite = null;
        }
    }

    public populateEdgeAndTwinInfo(sitePair: SitePair): void {
        if (sitePair.leftSite.siteId === this.leftSite.siteId) {
            if (sitePair.rightSite) {
                this.twin = new HalfEdge(sitePair.rightSite, sitePair.leftSite);
                this.twin.edge = new Edge(sitePair.rightSite, sitePair.leftSite);
            }
            this.edge = new Edge(sitePair.leftSite, sitePair.rightSite);

        } else if (sitePair.rightSite.siteId === this.leftSite.siteId) {
            if (sitePair.leftSite) {
                this.twin = new HalfEdge(sitePair.leftSite, sitePair.rightSite);
                this.twin.edge = new Edge(sitePair.leftSite, sitePair.rightSite);
            }
            this.edge = new Edge(sitePair.rightSite, sitePair.leftSite);
        }
    }

    public addEndPoint(point: Point): void {
        if (this.edge.vertexA) {
            this.edge.vertexB = point;
            this.twin.edge.vertexA = point;
        } else {
            this.edge.vertexA = point;
            this.twin.edge.vertexB = point;
        }
    }
}

export class Cell {
    site: Site;
    halfedges: Array<HalfEdge>;
}

export function pointCompareForPriorityQueue(point1: Point, point2: Point): number {
    let yDecision = point1.y - point2.y;
    if (yDecision) {
        return yDecision;
    } else {
        return point2.x - point1.x;
    }
}

export class Events {

    constructor(private _points: Array<Point>) {
        this._points.sort((point1, point2) => pointCompareForPriorityQueue(point1, point2));
    }

    public addCircleEvents(circleEvents: Point[]): void {
        for (let i = 0; i < circleEvents.length; i++) {
            this._points.push(circleEvents[i]);
        }
        this._points.sort((point1, point2) => pointCompareForPriorityQueue(point1, point2));
    }

    public pop(): Point {
        return this._points.pop();
    }

    public isEmpty(): boolean {
        return this._points.length === 0;
    }
}

export class DCEL {
    halfEdges: Array<HalfEdge> = [];

    public add(halfEdge: HalfEdge) {
        this.halfEdges.push(halfEdge);
        for (let i = 0; i < this.halfEdges.length; i++) {
            let listHalfEdge = this.halfEdges[i];
            if (listHalfEdge.leftSite.siteId === halfEdge.leftSite.siteId) {
                continue;
            }
            if (halfEdge.leftSite.point.x < listHalfEdge.leftSite.point.x) {
                let previousHalfEdge = listHalfEdge.previousHalfEdge;
                if (previousHalfEdge) {
                    if (halfEdge.leftSite.point.x < previousHalfEdge.leftSite.point.x) {
                        previousHalfEdge.previousHalfEdge = halfEdge;
                        halfEdge.nextHalfEdge = previousHalfEdge;
                    } else {
                        previousHalfEdge.nextHalfEdge = halfEdge;
                        halfEdge.nextHalfEdge = listHalfEdge;
                        halfEdge.previousHalfEdge = previousHalfEdge;
                        listHalfEdge.previousHalfEdge = halfEdge;
                    }
                } else {
                    halfEdge.nextHalfEdge = listHalfEdge;
                    listHalfEdge.previousHalfEdge = halfEdge;
                }
            } else {
                let nextHalfEdge = listHalfEdge.nextHalfEdge;
                if (nextHalfEdge) {
                    if (halfEdge.leftSite.point.x < nextHalfEdge.leftSite.point.x) {
                        nextHalfEdge.previousHalfEdge = halfEdge;
                        halfEdge.nextHalfEdge = nextHalfEdge;
                        listHalfEdge.nextHalfEdge = halfEdge;
                        halfEdge.previousHalfEdge = listHalfEdge;
                    } else {
                        nextHalfEdge.nextHalfEdge = halfEdge;
                        halfEdge.previousHalfEdge = nextHalfEdge;
                    }
                } else {
                    halfEdge.previousHalfEdge = listHalfEdge;
                    listHalfEdge.nextHalfEdge = halfEdge;
                }
            }
        }
    }

    public checkAndGetCircleEvents(): Point[] {
        if (this.halfEdges.length < 3) {
            return;
        }
        let circleEvents = [];

        let beachLineStart = this.getStartOfBeachLine(this.halfEdges[0]);

        for (let i = 0; i + 2 < this.halfEdges.length; i++) {

            let sites = this.getNext3SitesOnBeachLine(beachLineStart);
            //check if circle event
            let circle = getCircle(sites[0].point, sites[1].point, sites[2].point);
            if (circle) {
                let radius = getDistance(sites[0].point, sites[1].point);
                if (radius > 0) {
                    let circleEvent = new Point(circle.x, circle.y - radius);
                    circleEvents.push(circleEvent);
                }
            }
            beachLineStart = beachLineStart.nextHalfEdge;
        }

        return circleEvents;
    }

    public removeHalfEdge(site1: Site, site2: Site): void {
        for (let i = 0; i < this.halfEdges.length; i++) {
            let halfEdge = this.halfEdges[i];
            if (halfEdge.leftSite.point.id === site1.point.id && halfEdge.rightSite.point.id === site2.point.id) {
                let previousHalfEdge = halfEdge.previousHalfEdge;
                let nextHalfEdge = halfEdge.nextHalfEdge;
                previousHalfEdge.nextHalfEdge = nextHalfEdge;
                nextHalfEdge.previousHalfEdge = previousHalfEdge;
                halfEdge = null;
                this.halfEdges.splice(i, 1);
                return;
            }
        }
    }



    private getNext3SitesOnBeachLine(startHalfEdge: HalfEdge): Site[] {
        let point1 = startHalfEdge.leftSite;
        let point2 = startHalfEdge.nextHalfEdge.leftSite;
        let point3 = startHalfEdge.nextHalfEdge.nextHalfEdge.leftSite;
        return [point1, point2, point3];
    }

    private getStartOfBeachLine(startPoint: HalfEdge): HalfEdge {
        if (startPoint == null || !startPoint.previousHalfEdge) {
            return startPoint;
        }
        return this.getStartOfBeachLine(startPoint.previousHalfEdge);
    }
}

export class SitePair {
    leftSite: Site;
    rightSite: Site;
    constructor(left: Site, right: Site) {
        this.leftSite = left;
        if (right && left.siteId != right.siteId) {
            this.rightSite = right;
        } else {
            this.rightSite = null;
        }
    }
}

export class BTree {
    sitePair: SitePair;
    parent: BTree = null;
    leftChild: BTree = null;
    rightChild: BTree = null;
    dcel: DCEL = null;
    halfEdgeBeingTraced: HalfEdge = null;
    potentialCircleEvents: Point[] = null;
    siteArcTraced: Site = null;

    constructor(siteArcTraced: Site, dcel: DCEL, sitePair?: SitePair) {
        this.siteArcTraced = siteArcTraced;
        this.dcel = dcel;
        this.sitePair = sitePair;
    }

    public add(site: Site, dcel: DCEL): BTree {
        if (!this.sitePair) {
            this.sitePair = new SitePair(site, null);
            return this;
        } else if (this.sitePair && !this.sitePair.rightSite && this.sitePair.leftSite.siteId != site.siteId) {
            this.sitePair.rightSite = site;
            return this.addChild(this, site, dcel);
        } else {
            return this.addChild(this, site, dcel);
        }
    }

    public delete(startNode: BTree, circleEvent: Point, dcel: DCEL): BTree {
        if (startNode === null) {
            return startNode;
        }
        if (circleEvent.x < startNode.sitePair.leftSite.point.x) {
            let node = this.delete(startNode.leftChild, circleEvent, dcel);
            if (node === null) {
                startNode.potentialCircleEvents = null;
                if (startNode.halfEdgeBeingTraced) {
                    startNode.halfEdgeBeingTraced.addEndPoint(circleEvent);
                }
                startNode = null;
            }
        } else if (circleEvent.x >= startNode.sitePair.rightSite.point.x) {
            let node = this.delete(startNode.rightChild, circleEvent, dcel);
            if (node === null) {
                startNode.potentialCircleEvents = null;
                if (startNode.halfEdgeBeingTraced) {
                    startNode.halfEdgeBeingTraced.addEndPoint(circleEvent);
                }
                startNode = null;
            }
        } else {
            startNode.potentialCircleEvents = null;
            if (startNode.halfEdgeBeingTraced) {
                startNode.halfEdgeBeingTraced.addEndPoint(circleEvent);
            }
            dcel.removeHalfEdge(startNode.sitePair.leftSite, startNode.sitePair.rightSite);
            let leftSite = startNode.leftChild.sitePair.leftSite;
            startNode = this.deleteThis(startNode, circleEvent, dcel);
            let rightSite = startNode.sitePair.leftSite;
            let newHalfEdge = new HalfEdge(leftSite, rightSite);
            dcel.add(newHalfEdge);
        }
        return startNode;
    }

    private deleteThis(node: BTree, circleEvent: Point, dcel: DCEL): BTree {
        if (node.leftChild && node.rightChild === null) {
            return node.leftChild;
        } else if (node.rightChild && node.leftChild === null) {
            return node.rightChild;
        } else if (node.leftChild && node.rightChild) {
            let nextRoot = this.getNextSucessor(node);
            let leftChild = node.leftChild;
            node = nextRoot;
            node.leftChild = leftChild;

            return node;
        }

    }

    private getNextSucessor(node: BTree): BTree {
        if (node.rightChild === null) {
            return node;
        }
        return this.getNextSucessor(node.rightChild);
    }

    private addChild(startNode: BTree, site: Site, dcel: DCEL): BTree {
        if (startNode === null) {
            return startNode;
        }
        if (site.point.x < startNode.sitePair.leftSite.point.x) {
            let node = this.addChild(startNode.leftChild, site, dcel);
            if (node === null) {
                startNode.potentialCircleEvents = null;
                let newSitePair = new SitePair(site, startNode.sitePair.leftSite);

                this.halfEdgeBeingTraced = new HalfEdge(site, startNode.sitePair.leftSite);
                this.halfEdgeBeingTraced.populateEdgeAndTwinInfo(newSitePair);
                dcel.add(this.halfEdgeBeingTraced);

                let newNode = new BTree(site, this.dcel, newSitePair);
                newNode.parent = startNode;
                startNode.leftChild = newNode;
                return newNode;
            } else {
                return node;
            }
        } else if (site.point.x > startNode.sitePair.rightSite.point.x) {
            startNode.potentialCircleEvents = null;
            let node = this.addChild(startNode.rightChild, site, dcel);
            if (node === null) {
                let newSitePair = new SitePair(startNode.sitePair.rightSite, site);

                this.halfEdgeBeingTraced = new HalfEdge(startNode.sitePair.rightSite, site);
                this.halfEdgeBeingTraced.populateEdgeAndTwinInfo(newSitePair);
                dcel.add(this.halfEdgeBeingTraced);

                let newNode = new BTree(site, this.dcel, newSitePair);
                newNode.parent = startNode;
                startNode.rightChild = newNode;
                return newNode;
            } else {
                return node;
            }
        } else { // when the site in the middle of the site pair in startNode
            startNode.potentialCircleEvents = null;
            let startNodeRightSitePair = startNode.sitePair.rightSite;
            startNode.sitePair = new SitePair(startNode.sitePair.leftSite, site);

            this.halfEdgeBeingTraced = new HalfEdge(startNode.sitePair.leftSite, site);
            this.halfEdgeBeingTraced.populateEdgeAndTwinInfo(startNode.sitePair);
            dcel.add(this.halfEdgeBeingTraced);

            let node = this.addChild(startNode.rightChild, startNodeRightSitePair, dcel);
            if (node === null) {
                let newSitePair = new SitePair(site, startNodeRightSitePair);

                let newNode = new BTree(site, this.dcel, newSitePair);
                newNode.parent = startNode;
                startNode.rightChild = newNode;

                newNode.halfEdgeBeingTraced = new HalfEdge(site, startNodeRightSitePair);
                newNode.halfEdgeBeingTraced.populateEdgeAndTwinInfo(newSitePair);
                dcel.add(newNode.halfEdgeBeingTraced);
                return newNode;
            } else {
                return node;
            }

        }
    }
}

export function getDistance(point1: Point, point2: Point): number {
    let distance = -1;
    distance = Math.sqrt(Math.pow((point2.y - point1.y), 2) + Math.pow((point2.x - point1.x), 2));
    return distance;
}

export function getCircle(point1: Point, point2: Point, point3: Point): Point {
    let center: Point = null;

    // replicated from C++ code at http://paulbourke.net/geometry/circlesphere/Circle.cpp

    let yDeltaA = point2.y - point1.y;
    let xDeltaA = point2.x - point1.x;
    let yDeltaB = point3.y - point2.y;
    let xDeltaB = point3.x - point2.x;

    if ((Math.abs(xDeltaA) <= 0) && (Math.abs(yDeltaB) <= 0)) {
        let centerX = 0.5 * (point2.x + point3.x);
        let centerY = 0.5 * (point1.y + point2.y);
        center = new Point(centerX, centerY);
        return center;
    }

    if (xDeltaA !== 0 && xDeltaB !== 0) {
        let aSlope = yDeltaA / xDeltaA;
        let bSlope = yDeltaB / xDeltaB;

        let centerX = (aSlope * bSlope * (point1.y - point3.y) + bSlope * (point1.x + point2.x) - aSlope * (point2.x + point3.x)) / (2 * (bSlope - aSlope));

        let centerY = (-1 * (centerX - (point1.x + point2.x) / 2) / aSlope) + ((point1.y + point2.y) / 2);
        center = new Point(centerX, centerY);
        return center;
    }

    return center;
}
