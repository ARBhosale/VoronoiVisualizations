import BSTree from "typescript-collections/dist/lib/BSTree";
import { listenerCount } from "cluster";
import { prepareProfile } from "selenium-webdriver/firefox";
import { startTimeRange } from '@angular/core/src/profile/wtf_impl';
import { disableDebugTools } from '@angular/platform-browser/src/browser/tools/tools';
import { Event } from '_debugger';

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
    angle: number;
    constructor(_lSite: Site, _rSite: Site) {
        this.leftSite = _lSite;
        if (_rSite && _lSite.siteId != _rSite.siteId) {
            this.rightSite = _rSite;
        } else {
            this.rightSite = null;
        }

        // 'angle' is a value to be used for properly sorting the
        // halfsegments counterclockwise. By convention, we will
        // use the angle of the line defined by the 'site to the left'
        // to the 'site to the right'.
        // However, border edges have no 'site to the right': thus we
        // use the angle of line perpendicular to the halfsegment (the
        // edge should have both end points defined in such case.)
        if (_rSite) {
            this.angle = Math.atan2(_rSite.point.y - _lSite.point.y, _rSite.point.x - _lSite.point.x);
        }
        else {
            let va = this.edge.vertexA;
            let vb = this.edge.vertexB;
            // rhill 2011-05-31: used to call getStartpoint()/getEndpoint(),
            // but for performance purpose, these are expanded in place here.
            this.angle = this.edge.leftSite === _lSite ? Math.atan2(vb.x - va.x, va.y - vb.y)
                : Math.atan2(va.x - vb.x, vb.y - va.y);
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

    constructor(site: Site) {
        this.site = site;
        this.halfedges = [];
    }

    public addHalfEdge(halfEdge: HalfEdge): void {
        this.halfedges.push(halfEdge);
    }

    public prepare() {
        let halfedges = this.halfedges;
        let iHalfedge = halfedges.length;
        let edge: Edge;
        // get rid of unused halfedges
        // rhill 2011-05-27: Keep it simple, no point here in trying
        // to be fancy: dangling edges are a typically a minority.
        while (iHalfedge--) {
            edge = halfedges[iHalfedge].edge;
            if (!edge.vertexB || !edge.vertexA) {
                halfedges.splice(iHalfedge, 1);
            }
        }
        // rhill 2011-05-26: I tried to use a binary search at insertion
        // time to keep the array sorted on-the-fly (in Cell.addHalfedge()).
        // There was no real benefits in doing so, performance on
        // Firefox 3.6 was improved marginally, while performance on
        // Opera 11 was penalized marginally.
        halfedges.sort(function (a, b) { return b.angle - a.angle; });
        return halfedges.length;
    };
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

    public addCircleEvent(circleEvent: Point): void {
        if (!this.hasPoint(circleEvent)) {
            this._points.push(circleEvent);
        }

        this._points.sort((point1, point2) => pointCompareForPriorityQueue(point1, point2));
    }

    public pop(): Point {
        return this._points.pop();
    }

    public isEmpty(): boolean {
        return this._points.length === 0;
    }

    private hasPoint(point: Point): boolean {
        for (let i = 0; i < this._points.length; i++) {
            if (point.x === this._points[i].x && point.y === this._points[i].y) {
                return true;
            }
        }
        return false;
    }
}

export class DCEL {
    halfEdges: Array<HalfEdge> = [];
    edges: Array<Edge> = [];

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

    public getCells(): Cell[] {
        let cells: Cell[] = [];
        for (let i = 0; i < this.halfEdges.length; i++) {
            let halfEdge = this.halfEdges[i];
            let cell = new Cell(halfEdge.leftSite);
            cell.addHalfEdge(halfEdge);
            cells.push(cell);
        }
        return cells;
    }

    public getEdges(): Edge[] {
        let edges: Edge[] = [];
        for (let i = 0; i < this.halfEdges.length; i++) {
            let edge = this.halfEdges[i].edge;
            if (edge) {
                edges.push(edge);
            }
        }
        return this.edges.concat(edges);
    }

    public checkAndGetCircleEvent(tree: BTree, events: Events): Point {
        if (this.halfEdges.length < 3) {
            return;
        }
        let circleEvents = [];

        let beachLineStart = this.getStartOfBeachLine(this.halfEdges[0]);

        for (let i = 0; i + 2 < this.halfEdges.length; i++) {
            if (tree.hasCircleEvent(beachLineStart.nextHalfEdge)) {
                continue;
            }

            let sites = this.getNext3SitesOnBeachLine(beachLineStart);
            //check if circle event
            let circle = getCircle(sites[0].point, sites[1].point, sites[2].point);
            if (circle) {
                let radius = getDistance(sites[0].point, sites[1].point);
                if (radius > 0) {
                    let circleEvent = new Point(circle.x, circle.y - radius);
                    tree.storeCircleEvent(beachLineStart.nextHalfEdge, circleEvent);
                    events.addCircleEvent(circleEvent);
                    return circleEvent;
                }
            }
            beachLineStart = beachLineStart.nextHalfEdge;
        }
    }

    public removeHalfEdge(site1: Site, site2: Site): void {
        for (let i = 0; i < this.halfEdges.length; i++) {
            let halfEdge = this.halfEdges[i];
            if (halfEdge.leftSite.point.id === site1.point.id && halfEdge.rightSite.point.id === site2.point.id) {
                let previousHalfEdge = halfEdge.previousHalfEdge;
                let nextHalfEdge = halfEdge.nextHalfEdge;
                if (previousHalfEdge) {
                    previousHalfEdge.nextHalfEdge = nextHalfEdge;
                    nextHalfEdge.previousHalfEdge = previousHalfEdge;
                }
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
    potentialCircleEvent: Point = null;
    siteArcTraced: Site = null;

    constructor(siteArcTraced: Site, dcel: DCEL, sitePair?: SitePair) {
        this.siteArcTraced = siteArcTraced;
        this.dcel = dcel;
        this.sitePair = sitePair;
    }

    public storeCircleEvent(disappearingHalfEdge: HalfEdge, circleEvent: Point): void {
        if (this.halfEdgeBeingTraced.leftSite.siteId === disappearingHalfEdge.leftSite.siteId) {
            this.potentialCircleEvent = circleEvent;
            return;
        } else {
            if (this.leftChild) {
                this.leftChild.storeCircleEvent(disappearingHalfEdge, circleEvent);
            }
            if (this.rightChild) {
                this.rightChild.storeCircleEvent(disappearingHalfEdge, circleEvent);
            } else {
                return;
            }
        }
    }

    public hasCircleEvent(halfEdge: HalfEdge): boolean {
        if (this.halfEdgeBeingTraced.leftSite.siteId === halfEdge.leftSite.siteId && this.potentialCircleEvent) {
            return true;
        } else {
            if (this.leftChild) {
                if (this.leftChild.hasCircleEvent(halfEdge)) {
                    return true;
                }
            }
            if (this.rightChild) {
                if (this.rightChild.hasCircleEvent(halfEdge)) {
                    return true;
                }
            } else {
                return false;
            }
        }
    }

    public add(site: Site, dcel: DCEL): BTree {
        if (!this.sitePair) {
            this.sitePair = new SitePair(site, null);
            return this;
        } else if (this.sitePair && !this.sitePair.rightSite && this.sitePair.leftSite.siteId != site.siteId) {
            if (this.sitePair.leftSite.point.x <= site.point.x) {
                this.sitePair.rightSite = site;
            } else {
                let temp = this.sitePair.leftSite;
                this.sitePair.leftSite = site;
                this.sitePair.rightSite = temp;

                this.halfEdgeBeingTraced = new HalfEdge(this.sitePair.leftSite, this.sitePair.rightSite);
                this.halfEdgeBeingTraced.populateEdgeAndTwinInfo(this.sitePair);
                this.siteArcTraced = site;
                dcel.add(this.halfEdgeBeingTraced);
            }
            return this;
        } else {
            return this.addChild(this, site, dcel);
        }
    }

    private getNodeWithCircleEvent(startNode: BTree, circleEvent: Point): BTree {
        if (startNode.potentialCircleEvent && startNode.potentialCircleEvent.id === circleEvent.id) {
            return startNode;
        }
        let nodeInLeft = this.getNodeWithCircleEvent(startNode.leftChild, circleEvent);
        if (nodeInLeft) {
            return nodeInLeft;
        }
        let nodeInRight = this.getNodeWithCircleEvent(startNode.rightChild, circleEvent);
        if (nodeInRight) {
            return nodeInRight;
        }
        return null;
    }

    public delete(startNode: BTree, circleEvent: Point, dcel: DCEL): BTree {
        let nodeWithCircleEvent = this.getNodeWithCircleEvent(startNode, circleEvent);
        if (!nodeWithCircleEvent) {
            return null;
        }
        if (nodeWithCircleEvent.halfEdgeBeingTraced) {
            nodeWithCircleEvent.halfEdgeBeingTraced.addEndPoint(circleEvent);
        }
        this.deleteThis(nodeWithCircleEvent, dcel);
        // if (circleEvent.x < startNode.sitePair.leftSite.point.x) {
        //     let node = this.delete(startNode.leftChild, circleEvent, dcel);
        //     if (node === null) {
        //         startNode.potentialCircleEvent = null;
        //         if (startNode.halfEdgeBeingTraced) {
        //             startNode.halfEdgeBeingTraced.addEndPoint(circleEvent);
        //         }
        //         let parent = startNode.parent;
        //         startNode = null;
        //         return parent;
        //     }
        // } else if (circleEvent.x >= startNode.sitePair.rightSite.point.x) {
        //     let node = this.delete(startNode.rightChild, circleEvent, dcel);
        //     if (node === null) {
        //         startNode.potentialCircleEvent = null;
        //         if (startNode.halfEdgeBeingTraced) {
        //             startNode.halfEdgeBeingTraced.addEndPoint(circleEvent);
        //         }
        //         let parent = startNode.parent;
        //         startNode = null;
        //         return parent;
        //     }
        // } else {
        //     startNode.potentialCircleEvent = null;
        //     if (startNode.halfEdgeBeingTraced) {
        //         startNode.halfEdgeBeingTraced.addEndPoint(circleEvent);
        //     }
        //     dcel.removeHalfEdge(startNode.sitePair.leftSite, startNode.sitePair.rightSite);
        //     let leftSite = startNode.leftChild.sitePair.leftSite;
        //     startNode = this.deleteThis(startNode, circleEvent, dcel);
        //     let rightSite = startNode.sitePair.leftSite;
        //     let newHalfEdge = new HalfEdge(leftSite, rightSite);
        //     dcel.add(newHalfEdge);
        // }
        return startNode;
    }

    private deleteThis(node: BTree, dcel: DCEL): BTree {
        if (node.leftChild && node.rightChild === null) {
            return node.leftChild;
        } else if (node.rightChild && node.leftChild === null) {
            return node.rightChild;
        } else if (node.leftChild && node.rightChild) {
            let nodeHalfEdge = node.halfEdgeBeingTraced;
            let nextRoot = this.getNextSucessor(node.rightChild);
            if (nextRoot.sitePair.leftSite.siteId !== node.rightChild.sitePair.leftSite.siteId) {
                nextRoot.parent.leftChild = null;
                nextRoot.sitePair.rightSite = node.rightChild.sitePair.leftSite;
            }
            nextRoot.leftChild = node.leftChild;
            dcel.removeHalfEdge(node.sitePair.leftSite, node.sitePair.rightSite);
            dcel.edges.push(nodeHalfEdge.edge);
            dcel.removeHalfEdge(nextRoot.leftChild.sitePair.leftSite, nextRoot.leftChild.sitePair.rightSite);

            nextRoot.leftChild.sitePair.rightSite = nextRoot.sitePair.leftSite;
            let newHalfEdge = new HalfEdge(nextRoot.leftChild.sitePair.leftSite, nextRoot.leftChild.sitePair.rightSite);
            newHalfEdge.populateEdgeAndTwinInfo(nextRoot.leftChild.sitePair);
            dcel.add(newHalfEdge);
            node = nextRoot;

            return node;
        }

    }

    private getNextSucessor(node: BTree): BTree {
        if (node.leftChild === null) {
            return node;
        }
        return this.getNextSucessor(node.leftChild);
    }

    private addChild(startNode: BTree, site: Site, dcel: DCEL): BTree {
        if (startNode === null) {
            return startNode;
        }
        if (site.point.x < startNode.sitePair.leftSite.point.x) {
            let node = this.addChild(startNode.leftChild, site, dcel);
            if (node === null) {
                startNode.potentialCircleEvent = null;
                let newSitePair = new SitePair(site, startNode.sitePair.leftSite);

                let newNode = new BTree(site, this.dcel, newSitePair);

                newNode.halfEdgeBeingTraced = new HalfEdge(site, startNode.sitePair.leftSite);
                newNode.halfEdgeBeingTraced.populateEdgeAndTwinInfo(newSitePair);
                newNode.siteArcTraced = site;
                dcel.add(newNode.halfEdgeBeingTraced);


                newNode.parent = startNode;
                startNode.leftChild = newNode;
                return newNode;
            } else {
                return node;
            }
        } else if (site.point.x > startNode.sitePair.rightSite.point.x) {
            startNode.potentialCircleEvent = null;
            let node = this.addChild(startNode.rightChild, site, dcel);
            if (node === null) {
                let newSitePair = new SitePair(startNode.sitePair.rightSite, site);

                let newNode = new BTree(site, this.dcel, newSitePair);

                newNode.halfEdgeBeingTraced = new HalfEdge(startNode.sitePair.rightSite, site);
                newNode.halfEdgeBeingTraced.populateEdgeAndTwinInfo(newSitePair);
                newNode.siteArcTraced = startNode.sitePair.rightSite;
                dcel.add(newNode.halfEdgeBeingTraced);


                newNode.parent = startNode;
                startNode.rightChild = newNode;
                return newNode;
            } else {
                return node;
            }
        } else { // when the site in the middle of the site pair in startNode
            startNode.potentialCircleEvent = null;
            let startNodeLeftSite = startNode.sitePair.leftSite;
            startNode.sitePair = new SitePair(site, startNode.sitePair.rightSite);

            dcel.removeHalfEdge(startNodeLeftSite, startNode.sitePair.rightSite);
            startNode.halfEdgeBeingTraced = new HalfEdge(startNode.sitePair.leftSite, startNode.sitePair.rightSite);
            startNode.halfEdgeBeingTraced.populateEdgeAndTwinInfo(startNode.sitePair);
            dcel.add(startNode.halfEdgeBeingTraced);

            let node = this.addChild(startNode.leftChild, startNodeLeftSite, dcel);
            if (node === null) {
                let newSitePair = new SitePair(startNodeLeftSite, site);

                let newNode = new BTree(startNodeLeftSite, this.dcel, newSitePair);
                newNode.parent = startNode;
                startNode.leftChild = newNode;

                newNode.halfEdgeBeingTraced = new HalfEdge(startNodeLeftSite, site);
                newNode.halfEdgeBeingTraced.populateEdgeAndTwinInfo(newSitePair);
                newNode.siteArcTraced = startNodeLeftSite;
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

// ---------------------------------------------------------------------------
// Diagram completion methods

// connect dangling edges (not if a cursory test tells us
// it is not going to be visible.
// return value:
//   false: the dangling endpoint couldn't be connected
//   true: the dangling endpoint could be connected
export function connectEdge(edge: Edge, bbox) {
    // skip if end point already connected
    var vb = edge.vertexB;
    if (!!vb) { return true; }

    // make local copy for performance purpose
    var va = edge.vertexA,
        xl = bbox.xl,
        xr = bbox.xr,
        yt = bbox.yt,
        yb = bbox.yb,
        lSite = edge.leftSite,
        rSite = edge.rightSite,
        lx = lSite.point.x,
        ly = lSite.point.y,
        rx = rSite.point.x,
        ry = rSite.point.y,
        fx = (lx + rx) / 2,
        fy = (ly + ry) / 2,
        fm, fb;

    // get the line equation of the bisector if line is not vertical
    if (ry !== ly) {
        fm = (lx - rx) / (ry - ly);
        fb = fy - fm * fx;
    }

    // remember, direction of line (relative to left site):
    // upward: left.x < right.x
    // downward: left.x > right.x
    // horizontal: left.x == right.x
    // upward: left.x < right.x
    // rightward: left.y < right.y
    // leftward: left.y > right.y
    // vertical: left.y == right.y

    // depending on the direction, find the best side of the
    // bounding box to use to determine a reasonable start point

    // special case: vertical line
    if (fm === undefined) {
        // doesn't intersect with viewport
        if (fx < xl || fx >= xr) { return false; }
        // downward
        if (lx > rx) {
            if (!va) {
                va = new Point(fx, yt);
            }
            else if (va.y >= yb) {
                return false;
            }
            vb = new Point(fx, yb);
        }
        // upward
        else {
            if (!va) {
                va = new Point(fx, yb);
            }
            else if (va.y < yt) {
                return false;
            }
            vb = new Point(fx, yt);
        }
    }
    // closer to vertical than horizontal, connect start point to the
    // top or bottom side of the bounding box
    else if (fm < -1 || fm > 1) {
        // downward
        if (lx > rx) {
            if (!va) {
                va = new Point((yt - fb) / fm, yt);
            }
            else if (va.y >= yb) {
                return false;
            }
            vb = new Point((yb - fb) / fm, yb);
        }
        // upward
        else {
            if (!va) {
                va = new Point((yb - fb) / fm, yb);
            }
            else if (va.y < yt) {
                return false;
            }
            vb = new Point((yt - fb) / fm, yt);
        }
    }
    // closer to horizontal than vertical, connect start point to the
    // left or right side of the bounding box
    else {
        // rightward
        if (ly < ry) {
            if (!va) {
                va = new Point(xl, fm * xl + fb);
            }
            else if (va.x >= xr) {
                return false;
            }
            vb = new Point(xr, fm * xr + fb);
        }
        // leftward
        else {
            if (!va) {
                va = new Point(xr, fm * xr + fb);
            }
            else if (va.x < xl) {
                return false;
            }
            vb = new Point(xl, fm * xl + fb);
        }
    }
    edge.vertexA = va;
    edge.vertexB = vb;
    return true;
};

// line-clipping code taken from:
//   Liang-Barsky function by Daniel White
//   http://www.skytopia.com/project/articles/compsci/clipping.html
// Thanks!
// A bit modified to minimize code paths
export function clipEdge(edge: Edge, bbox) {
    var ax = edge.vertexA.x,
        ay = edge.vertexA.y,
        bx = edge.vertexB.x,
        by = edge.vertexB.y,
        t0 = 0,
        t1 = 1,
        dx = bx - ax,
        dy = by - ay;
    // left
    var q = ax - bbox.xl;
    if (dx === 0 && q < 0) { return false; }
    var r = -q / dx;
    if (dx < 0) {
        if (r < t0) { return false; }
        else if (r < t1) { t1 = r; }
    }
    else if (dx > 0) {
        if (r > t1) { return false; }
        else if (r > t0) { t0 = r; }
    }
    // right
    q = bbox.xr - ax;
    if (dx === 0 && q < 0) { return false; }
    r = q / dx;
    if (dx < 0) {
        if (r > t1) { return false; }
        else if (r > t0) { t0 = r; }
    }
    else if (dx > 0) {
        if (r < t0) { return false; }
        else if (r < t1) { t1 = r; }
    }
    // top
    q = ay - bbox.yt;
    if (dy === 0 && q < 0) { return false; }
    r = -q / dy;
    if (dy < 0) {
        if (r < t0) { return false; }
        else if (r < t1) { t1 = r; }
    }
    else if (dy > 0) {
        if (r > t1) { return false; }
        else if (r > t0) { t0 = r; }
    }
    // bottom		
    q = bbox.yb - ay;
    if (dy === 0 && q < 0) { return false; }
    r = q / dy;
    if (dy < 0) {
        if (r > t1) { return false; }
        else if (r > t0) { t0 = r; }
    }
    else if (dy > 0) {
        if (r < t0) { return false; }
        else if (r < t1) { t1 = r; }
    }

    // if we reach this point, Voronoi edge is within bbox

    // if t0 > 0, va needs to change
    // rhill 2011-06-03: we need to create a new vertex rather
    // than modifying the existing one, since the existing
    // one is likely shared with at least another edge
    if (t0 > 0) {
        edge.vertexA = new Point(ax + t0 * dx, ay + t0 * dy);
    }

    // if t1 < 1, vb needs to change
    // rhill 2011-06-03: we need to create a new vertex rather
    // than modifying the existing one, since the existing
    // one is likely shared with at least another edge
    if (t1 < 1) {
        edge.vertexB = new Point(ax + t1 * dx, ay + t1 * dy);
    }

    return true;
}

// Connect/cut edges at bounding box
export function clipEdges(bbox, dcel: DCEL) {
    // connect all dangling edges to bounding box
    // or get rid of them if it can't be done
    let edges: Edge[] = dcel.getEdges();

    let iEdge = edges.length;
    var abs_fn = Math.abs;
    let edge: Edge = null;
    // iterate backward so we can splice safely
    while (iEdge--) {
        edge = edges[iEdge];
        // edge is removed if:
        //   it is wholly outside the bounding box
        //   it is actually a point rather than a line
        if (!connectEdge(edge, bbox) || !clipEdge(edge, bbox) || (abs_fn(edge.vertexA.x - edge.vertexB.x) < 1e-9 && abs_fn(edge.vertexA.y - edge.vertexB.y) < 1e-9)) {
            edge.vertexA = edge.vertexB = null;
            edges.splice(iEdge, 1);
        }
    }
}

// Close the cells.
// The cells are bound by the supplied bounding box.
// Each cell refers to its associated site, and a list
// of halfedges ordered counterclockwise.
export function closeCells(bbox, dcel: DCEL) {
    // prune, order halfedges, then add missing ones
    // required to close cells
    let xl = bbox.xl;
    let xr = bbox.xr;
    let yt = bbox.yt;
    let yb = bbox.yb;

    let cells = dcel.getCells();
    let iCell = cells.length;
    let cell: Cell;
    let iLeft, iRight;
    let halfedges, nHalfedges;
    let edge;
    let startpoint, endpoint;
    let va, vb;
    let abs_fn = Math.abs;

    while (iCell--) {
        cell = cells[iCell];
        // trim non fully-defined halfedges and sort them counterclockwise
        if (!cell.prepare()) {
            continue;
        }
        // close open cells
        // step 1: find first 'unclosed' point, if any.
        // an 'unclosed' point will be the end point of a halfedge which
        // does not match the start point of the following halfedge
        halfedges = cell.halfedges;
        nHalfedges = halfedges.length;
        // special case: only one site, in which case, the viewport is the cell
        // ...
        // all other cases
        iLeft = 0;
        while (iLeft < nHalfedges) {
            iRight = (iLeft + 1) % nHalfedges;
            endpoint = halfedges[iLeft].getEndpoint();
            startpoint = halfedges[iRight].getStartpoint();
            // if end point is not equal to start point, we need to add the missing
            // halfedge(s) to close the cell
            if (abs_fn(endpoint.x - startpoint.x) >= 1e-9 || abs_fn(endpoint.y - startpoint.y) >= 1e-9) {
                // if we reach this point, cell needs to be closed by walking
                // counterclockwise along the bounding box until it connects
                // to next halfedge in the list
                va = endpoint;
                // walk downward along left side
                if (this.equalWithEpsilon(endpoint.x, xl) && this.lessThanWithEpsilon(endpoint.y, yb)) {
                    vb = new this.Vertex(xl, this.equalWithEpsilon(startpoint.x, xl) ? startpoint.y : yb);
                }
                // walk rightward along bottom side
                else if (this.equalWithEpsilon(endpoint.y, yb) && this.lessThanWithEpsilon(endpoint.x, xr)) {
                    vb = new this.Vertex(this.equalWithEpsilon(startpoint.y, yb) ? startpoint.x : xr, yb);
                }
                // walk upward along right side
                else if (this.equalWithEpsilon(endpoint.x, xr) && this.greaterThanWithEpsilon(endpoint.y, yt)) {
                    vb = new this.Vertex(xr, this.equalWithEpsilon(startpoint.x, xr) ? startpoint.y : yt);
                }
                // walk leftward along top side
                else if (this.equalWithEpsilon(endpoint.y, yt) && this.greaterThanWithEpsilon(endpoint.x, xl)) {
                    vb = new this.Vertex(this.equalWithEpsilon(startpoint.y, yt) ? startpoint.x : xl, yt);
                }
                edge = this.createBorderEdge(cell.site, va, vb);
                halfedges.splice(iLeft + 1, 0, new this.Halfedge(edge, cell.site, null));
                nHalfedges = halfedges.length;
            }
            iLeft++;
        }
    }
};

// ---------------------------------------------------------------------------
