#include <iostream>

using namespace std;
int main()
{
    int N, numeros, divisiveis = 0;
    cin >> N;
    
    for(int i = 0; i < N; i++){
        cin >> numeros;
        if(numeros % 3 == 0){
            divisiveis++;
        }
    }
    cout << divisiveis << endl;
    
    
    
    
    
    
    return 0;
}