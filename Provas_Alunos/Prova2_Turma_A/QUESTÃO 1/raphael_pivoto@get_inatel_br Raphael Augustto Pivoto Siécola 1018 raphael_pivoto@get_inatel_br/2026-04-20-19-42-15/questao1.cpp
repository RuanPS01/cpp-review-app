#include <iostream>
using namespace std;

int main() {
    int N, A, P;
    
    cin >> N >> A >> P;
    
    for (int I = 0; I < N; I++) {
        cout << A << " ";
        A += P;
    }
    return(0);
}