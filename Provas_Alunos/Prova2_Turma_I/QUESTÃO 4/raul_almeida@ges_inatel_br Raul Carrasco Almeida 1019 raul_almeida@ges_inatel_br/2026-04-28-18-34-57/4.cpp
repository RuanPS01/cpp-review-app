#include <iostream>
#include <cstring>

using namespace std;
int main()
{
    float N, emprestimo;
    char id[2000];
    cin >> N;
    
    for(int i = 0; i < N; i++){
        cin >> id >> emprestimo;
        if (emprestimo == 0){
            cout << id << endl;
        }
        else
        cout << emprestimo << endl;
        
    }
    
    
    
    
    return 0;
}