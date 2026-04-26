#include <iostream>

using namespace std;

int main(){
    
    int N,A,R;
    
    cin >> N >> A >> R;
    
    for(int i = 0;i < N;i++)
    {
        cout << A << " ";
        A += R;
    }
    
    return 0;
}