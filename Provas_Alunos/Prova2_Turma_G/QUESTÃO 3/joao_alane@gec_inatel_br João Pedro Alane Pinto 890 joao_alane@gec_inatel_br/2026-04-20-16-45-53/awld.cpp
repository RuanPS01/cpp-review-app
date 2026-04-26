#include <iostream>
using namespace std;
int main () {
    int x,n;
    double num = 0;
    int MaiorTempo;
    
    while (x!=0) {
        if (MaiorTempo == 0 || MaiorTempo > num) 
        MaiorTempo=num;
    }
    cout << " " << x;
    cout << MaiorTempo;
    
    return 0;
}


